const endpointUrl = 'http://landregistry.data.gov.uk/landregistry/query';
const sparqlQuery = `
PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?paon ?saon ?street ?town ?county ?postcode ?amount ?date
WHERE {
  ?transx lrppi:propertyAddress ?addr ;
          lrppi:pricePaid ?amount ;
          lrppi:transactionDate ?date .
  
  # Try by postcode first
  ?addr lrcommon:postcode "NW7 4LE"^^xsd:string .
  
  OPTIONAL { ?addr lrcommon:paon ?paon }
  OPTIONAL { ?addr lrcommon:saon ?saon }
  OPTIONAL { ?addr lrcommon:street ?street }
  OPTIONAL { ?addr lrcommon:town ?town }
  OPTIONAL { ?addr lrcommon:county ?county }
  
  # Filter to last 5 years (approx)
  FILTER (?date >= "2019-01-01"^^xsd:date)
}
ORDER BY DESC(?date)
LIMIT 100
`;

async function test() {
    const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/sparql-results+json'
        },
        body: 'query=' + encodeURIComponent(sparqlQuery)
    });

    const data = await response.json();
    console.log(JSON.stringify(data.results.bindings, null, 2));
}

test().catch(console.error);
