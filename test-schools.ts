import { getAttendedSchools } from './src/lib/scraper/locrating';

async function test() {
    const result = await getAttendedSchools('81 Marsh Ln, London NW7 4LE, UK', 51.6253, -0.2443);
    console.log(JSON.stringify(result, null, 2));
}

test();
