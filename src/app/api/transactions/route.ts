import { NextResponse } from 'next/server';

export const maxDuration = 60; // Allow more time for SPARQL queries if needed

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const postcode = searchParams.get('postcode');
    const doorNumber = searchParams.get('doorNumber');

    if (!postcode) {
        return NextResponse.json({ success: false, error: 'Postcode is required' }, { status: 400 });
    }

    try {
        const endpointUrl = 'http://landregistry.data.gov.uk/landregistry/query';

        // We fetch a bit further back (10 years) to have a better chance of finding the target property
        // But we will primarily display recent ones
        const sparqlQuery = `
      PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
      PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

      SELECT *
      WHERE {
        ?transx lrppi:propertyAddress ?addr ;
                lrppi:pricePaid ?amount ;
                lrppi:transactionDate ?date .
        
        ?addr lrcommon:postcode "${postcode}"^^xsd:string .
        
        OPTIONAL { ?addr lrcommon:paon ?paon }
        OPTIONAL { ?addr lrcommon:saon ?saon }
        OPTIONAL { ?addr lrcommon:street ?street }
        OPTIONAL { ?addr lrcommon:town ?town }
        OPTIONAL { ?addr lrcommon:county ?county }
        OPTIONAL { ?transx lrppi:propertyType ?propertyTypeURI }
        OPTIONAL { ?transx lrppi:propertyType/lrcommon:label ?propertyType }
        OPTIONAL { ?transx lrppi:estateType ?estateTypeURI }
        OPTIONAL { ?transx lrppi:estateType/lrcommon:label ?estateType }
        OPTIONAL { ?transx lrppi:newBuild ?newBuild }
        OPTIONAL { ?transx lrppi:transactionCategory/lrcommon:label ?category }

        FILTER (?date >= "1995-01-01"^^xsd:date)
      }
      ORDER BY DESC(?date)
      LIMIT 500
    `;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(endpointUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/sparql-results+json'
            },
            body: 'query=' + encodeURIComponent(sparqlQuery),
            signal: controller.signal,
            next: { revalidate: 86400 * 7 } // cache for 7 days
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Land Registry API returned ${response.status}`);
        }

        const data = await response.json();
        const bindings = data.results?.bindings || [];

        // Map to our unified format
        const allTransactions = bindings.map((b: any) => {
            const extractLabel = (uri: string | null) => {
                if (!uri) return null;
                const name = uri.split('/').pop()?.replace(/-/g, ' ');
                if (!name) return null;
                return name.charAt(0).toUpperCase() + name.slice(1);
            };

            return {
                paon: b.paon?.value || null,
                saon: b.saon?.value || null,
                street: b.street?.value || null,
                town: b.town?.value || null,
                county: b.county?.value || null,
                postcode: postcode,
                amount: parseInt(b.amount?.value, 10),
                date: b.date?.value,
                propertyType: b.propertyType?.value || extractLabel(b.propertyTypeURI?.value) || null,
                newBuild: b.newBuild?.value === 'true',
                estateType: b.estateType?.value || extractLabel(b.estateTypeURI?.value) || null,
                transactionCategory: b.category?.value || null,
            };
        });

        let results = allTransactions;

        // Auto-Discovery: Try to find the exact property and filter by its attributes
        if (doorNumber) {
            const normalizedDoorNumber = doorNumber.toLowerCase().trim();

            // Find the exact property in the results
            const exactMatch = allTransactions.find((t: any) => {
                if (!t.paon && !t.saon) return false;
                const paonMatch = t.paon && t.paon.toLowerCase().trim() === normalizedDoorNumber;
                const saonMatch = t.saon && t.saon.toLowerCase().trim() === normalizedDoorNumber;
                return paonMatch || saonMatch;
            });

            // If we found it and it has a property type/estate type, filter out dissimilar properties
            if (exactMatch && exactMatch.propertyType && exactMatch.estateType) {
                results = allTransactions.filter((t: any) =>
                    t.propertyType === exactMatch.propertyType &&
                    t.estateType === exactMatch.estateType
                );
            }
        }

        // Limit to the most recent 15 transactions after filtering
        results = results.slice(0, 15);

        return NextResponse.json({ success: true, data: results });

    } catch (error: any) {
        console.error('Error fetching transactions:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
