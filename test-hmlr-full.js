const endpointUrl = 'http://landregistry.data.gov.uk/landregistry/query';
const sparqlQuery = `
PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT *
WHERE {
  ?transx lrppi:propertyAddress ?addr ;
          lrppi:pricePaid ?amount ;
          lrppi:transactionDate ?date .
  
  ?addr lrcommon:postcode "NW7 4LE"^^xsd:string .
  
  OPTIONAL { ?addr lrcommon:paon ?paon }
  OPTIONAL { ?addr lrcommon:saon ?saon }
  OPTIONAL { ?addr lrcommon:street ?street }
  OPTIONAL { ?addr lrcommon:town ?town }
  OPTIONAL { ?addr lrcommon:county ?county }
  OPTIONAL { ?transx lrppi:propertyType/lrcommon:label ?propertyType }
  OPTIONAL { ?transx lrppi:estateType/lrcommon:label ?estateType }
  OPTIONAL { ?transx lrppi:newBuild ?newBuild }
  OPTIONAL { ?transx lrppi:transactionCategory/lrcommon:label ?category }
  OPTIONAL { ?transx lrppi:recordStatus/lrcommon:label ?status }

  FILTER (?date >= "2019-01-01"^^xsd:date)
}
ORDER BY DESC(?date)
LIMIT 1
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
    console.log(JSON.stringify(data.results.bindings[0], null, 2));
}

test().catch(console.error);
