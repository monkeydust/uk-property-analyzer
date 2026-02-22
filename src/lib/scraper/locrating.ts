import { chromium, Browser, Page, Frame, BrowserContext } from 'playwright';
import { promises as fs } from 'fs';
import path from 'path';
import { AttendedSchool, AttendedSchoolsResult } from '@/lib/types/property';

const DEBUG_DIR = path.join(process.cwd(), 'debug');
const COOKIES_PATH = path.join(DEBUG_DIR, 'locrating-cookies.json');

let _scrapeStart = 0;
function log(msg: string) {
  const elapsed = _scrapeStart ? `+${((Date.now() - _scrapeStart) / 1000).toFixed(1)}s` : '';
  console.log(`[Locrating${elapsed}] ${msg}`);
}
function logErr(msg: string, err?: unknown) {
  const elapsed = _scrapeStart ? `+${((Date.now() - _scrapeStart) / 1000).toFixed(1)}s` : '';
  const detail = err instanceof Error ? err.message : (err ? String(err) : '');
  console.error(`[Locrating${elapsed}] ERROR: ${msg}${detail ? ` — ${detail}` : ''}`);
}

// The login system lives on a separate subdomain (aMember Pro platform)
const LOCRATING_LOGIN_URL = 'https://members.locrating.com/members/login';
const LOCRATING_LOGIN_CHECK_URL = 'https://members.locrating.com/members/page/is_logged_in';

// The school catchment areas page — we search for an address here and it
// renders the map with school markers, catchment overlays, and the attended
// schools data we need.
const LOCRATING_CATCHMENT_URL = 'https://www.locrating.com/school_catchment_areas.aspx';

// Ofsted rating number → human-readable text
const OFSTED_RATINGS: Record<string, string> = {
  '1': 'Outstanding',
  '2': 'Good',
  '3': 'Requires Improvement',
  '4': 'Inadequate',
};

/**
 * Ensure the debug directory exists for saving captured HTML + cookies
 */
async function ensureDebugDir(): Promise<void> {
  try {
    await fs.mkdir(DEBUG_DIR, { recursive: true });
  } catch {
    // directory already exists
  }
}

/**
 * Launch a Playwright Chromium browser in headless mode
 */
export async function launchBrowser(): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'en-GB',
  });

  // Try to load saved cookies for session reuse
  try {
    const cookieData = await fs.readFile(COOKIES_PATH, 'utf-8');
    const cookies = JSON.parse(cookieData);
    if (Array.isArray(cookies) && cookies.length > 0) {
      await context.addCookies(cookies);
      log(`Loaded ${cookies.length} saved cookies`);
    }
  } catch {
    log('No saved cookies found — will login fresh');
  }

  return { browser, context };
}

/**
 * Save browser cookies to disk for session reuse.
 * Captures cookies from both www.locrating.com and members.locrating.com.
 */
async function saveCookies(context: BrowserContext): Promise<void> {
  await ensureDebugDir();
  const cookies = await context.cookies([
    'https://www.locrating.com',
    'https://members.locrating.com',
  ]);
  await fs.writeFile(COOKIES_PATH, JSON.stringify(cookies, null, 2));
  log(`Saved ${cookies.length} cookies to disk`);
}

/**
 * Check if the browser session is authenticated by hitting the aMember
 * is_logged_in endpoint (the same one the main site uses via AJAX).
 */
async function isLoggedIn(context: BrowserContext): Promise<boolean> {
  let page: Page | null = null;
  try {
    page = await context.newPage();
    const response = await page.goto(LOCRATING_LOGIN_CHECK_URL, {
      waitUntil: 'networkidle',
      timeout: 10000,
    });

    if (!response) return false;

    const body = await page.textContent('body');
    await page.close();

    // The endpoint returns text like: "Welcome, ravi Status:1 (jklondon)(jklondon@gmail.com)"
    // when logged in, or a login form / error when not logged in.
    if (body && (
      body.includes('Welcome') ||
      body.includes('Status:1') ||
      body.includes('true') ||
      body.includes('logged_in') ||
      body.includes('"ok"')
    )) {
      log('Session check: authenticated');
      return true;
    }

    log(`Session check: not authenticated (body preview: ${body?.slice(0, 100)})`);
    return false;
  } catch (error) {
    logErr('Session check request failed', error);
    if (page) await page.close().catch(() => {});
    return false;
  }
}

/**
 * Log in to Locrating.com via the aMember members portal.
 *
 * Actual form fields:
 *   - input[name="amember_login"]  — username / email
 *   - input[name="amember_pass"]   — password
 *   - input[name="remember_login"] — stay signed in
 *   - input[type="submit"]         — submit
 *   - form.am-login-form-form      — POSTs to /members/login
 *
 * On success the server redirects to /members/page/noticeboard.
 */
export async function loginToLocrating(page: Page): Promise<boolean> {
  const email = process.env.LOCRATING_EMAIL;
  const password = process.env.LOCRATING_PASSWORD;

  if (!email || !password) {
    console.error('Missing LOCRATING_EMAIL or LOCRATING_PASSWORD environment variables');
    return false;
  }

  try {
    log('Navigating to Locrating login page...');
    await page.goto(LOCRATING_LOGIN_URL, { waitUntil: 'networkidle', timeout: 30000 });

    await page.waitForSelector('input[name="amember_login"]', { timeout: 10000 });
    log('Login form found, filling credentials...');

    await page.fill('input[name="amember_login"]', email);
    await page.fill('input[name="amember_pass"]', password);

    const rememberMe = await page.$('input[name="remember_login"]');
    if (rememberMe) {
      const isChecked = await rememberMe.isChecked();
      if (!isChecked) await rememberMe.check();
    }

    log('Submitting login form...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
      page.click('form.am-login-form-form input[type="submit"]'),
    ]);

    await page.waitForTimeout(2000);

    const errorText = await page.$eval(
      '.am-errors, .errors, .error, .alert-danger, .am-form-error',
      (el) => el.textContent?.trim() || ''
    ).catch(() => '');

    if (errorText) {
      logErr(`Login form error: ${errorText}`);
      return false;
    }

    const currentUrl = page.url();
    const hasPasswordField = await page.$('input[name="amember_pass"]');

    if (currentUrl.includes('/login') && hasPasswordField) {
      logErr(`Login failed — still on login page (url: ${currentUrl})`);
      return false;
    }

    log(`Login successful — redirected to: ${currentUrl}`);
    return true;
  } catch (error) {
    logErr('Login threw exception', error);
    return false;
  }
}

/**
 * Dismiss any modal dialogs that Locrating shows on page load.
 *
 * Known modals on the MAIN page:
 *   - Bootstrap "Ofsted report cards" announcement dialog
 *
 * Known modals INSIDE the iframe:
 *   - Semantic UI start dialog (#school_start_message-modal) — dismissed with Escape
 */
async function dismissModals(page: Page, iframe: Frame | null): Promise<void> {
  // 1. Main page Bootstrap modal
  try {
    const closeBtn = await page.$('.modal.show .close, .modal.show button[data-dismiss="modal"], .modal.show .btn-close');
    if (closeBtn) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
  } catch {
    // No modal to dismiss
  }

  // 2. Iframe Semantic UI start dialog — pressing Escape dismisses it
  if (iframe) {
    try {
      await iframe.click('body').catch(() => {});
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    } catch {
      // No start dialog
    }
  }
}

/**
 * Parse a raw school object from the GetAttendedSchools_plugin API response
 * into our structured AttendedSchool type.
 */
function parseAttendedSchool(raw: Record<string, unknown>, phase: 'primary' | 'secondary'): AttendedSchool {
  const school = raw.School as Record<string, unknown> | undefined;
  const ofstedNum = school?.OfstedRatingNumber as string | undefined;

  return {
    urn: (raw.Urn as string) || '',
    name: (school?.Name as string) || 'Unknown',
    phase,
    percentage: (raw.Percentage as number) || 0,
    ofstedRating: ofstedNum ? (OFSTED_RATINGS[ofstedNum] || null) : null,
    ofstedRatingNumber: ofstedNum ? parseInt(ofstedNum, 10) : null,
    admissionsPolicy: (school?.AdmissionsPolicy as string) || '',
    isGrammar: (school?.AdmissionsPolicy as string) === 'selective',
    coordinates: {
      lat: (school?.Lat as number) || 0,
      lng: (school?.Lng as number) || 0,
    },
    locratingRatingNumber: (school?.LocratingRatingNumber as string) || '0',
  };
}

/**
 * Parse the GetAttendedSchools_plugin API response.
 *
 * The response is JSON with a `d` field containing JavaScript code like:
 *   showAttendedSchoolsData('Barnet 005C', '[...primaryJSON...]', '[...secondaryJSON...]');
 *
 * We extract the area name, primary school JSON array, and secondary school JSON array.
 */
function parseAttendedSchoolsResponse(responseBody: string): {
  areaName: string;
  primarySchools: AttendedSchool[];
  secondarySchools: AttendedSchool[];
} | null {
  try {
    const parsed = JSON.parse(responseBody);
    const jsCode = parsed.d as string;
    if (!jsCode) return null;

    // Match: showAttendedSchoolsData('AreaName', '[primaryJSON]', '[secondaryJSON]')
    const regex = /showAttendedSchoolsData\s*\(\s*'([^']+)'\s*,\s*'(\[[\s\S]*?\])'\s*,\s*'(\[[\s\S]*?\])'\s*\)/;
    const match = jsCode.match(regex);
    if (!match) return null;

    const areaName = match[1];
    const primaryRaw = JSON.parse(match[2]) as Record<string, unknown>[];
    const secondaryRaw = JSON.parse(match[3]) as Record<string, unknown>[];

    const primarySchools = primaryRaw
      .map(s => parseAttendedSchool(s, 'primary'))
      .sort((a, b) => b.percentage - a.percentage);

    const secondarySchools = secondaryRaw
      .map(s => parseAttendedSchool(s, 'secondary'))
      .sort((a, b) => b.percentage - a.percentage);

    return { areaName, primarySchools, secondarySchools };
  } catch (error) {
    console.error('Failed to parse attended schools response:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Full flow: Fetch "Schools Attended" data for a given address from Locrating.
 *
 * How it works (proven via debug/test-manual-house-click.mjs):
 *
 * 1. Launch browser, login if needed (with cookie reuse)
 * 2. Navigate to school_catchment_areas.aspx
 * 3. Find the schoolsmap_osm iframe (all controls live inside it)
 * 4. Dismiss modal dialogs
 * 5. Open the sidebar and check "Place Home Marker at Location"
 * 6. Type the address into #mapsearch and press Enter
 *    → This triggers a Nominatim geocode which repositions the map
 * 7. Capture the map center coordinates after geocode settles
 *    → These coordinates land in the correct LSOA (neighbourhood area)
 * 8. Embed attended_schools.aspx as an iframe with those coordinates
 *    → This triggers the GetAttendedSchools_plugin API call
 * 9. Intercept the API response and parse the structured data
 * 10. Return AttendedSchoolsResult with area name, primary & secondary schools
 *
 * Key discovery: The Nominatim geocode coordinates from Locrating's own
 * search flow give the correct LSOA. External geocoding may land in a
 * slightly different LSOA (e.g. Barnet 005B vs 005C).
 */
export async function getAttendedSchools(address: string, knownLat?: number, knownLng?: number): Promise<AttendedSchoolsResult> {
  await ensureDebugDir();
  _scrapeStart = Date.now();
  log(`Starting scrape for: "${address}"`);

  let browser: Browser | null = null;

  try {
    // Step 1: Launch browser with saved cookies
    log('Step 1: Launching browser...');
    const { browser: b, context } = await launchBrowser();
    browser = b;
    log('Browser launched');

    // Step 2: Check if saved cookies give us an authenticated session
    log('Step 2: Checking login state...');
    const loggedIn = await isLoggedIn(context);

    if (!loggedIn) {
      log('Not logged in — performing fresh login...');
      const loginPage = await context.newPage();
      const loginSuccess = await loginToLocrating(loginPage);

      if (!loginSuccess) {
        logErr('Login failed');
        await browser.close();
        return {
          success: false,
          areaName: null,
          coordinates: null,
          primarySchools: [],
          secondarySchools: [],
          error: 'Failed to log in to Locrating',
        };
      }

      await saveCookies(context);
      await loginPage.close();
      log('Login successful, cookies saved');
    } else {
      log('Already authenticated via saved cookies');
    }

    // Step 3: Navigate to school catchment areas page
    const page = await context.newPage();

    // Set up API response interception for GetAttendedSchools_plugin
    let attendedResponse: string | null = null;
    context.on('response', async (resp) => {
      const url = resp.url();
      if (url.includes('GetAttendedSchools_plugin')) {
        try {
          const body = await resp.text();
          if (body.length > 200) {
            attendedResponse = body;
            log(`GetAttendedSchools_plugin response captured (${body.length} bytes)`);
          } else {
            log(`GetAttendedSchools_plugin response too short (${body.length} bytes) — skipping`);
          }
        } catch (e) {
          logErr('Could not read GetAttendedSchools_plugin response body', e);
        }
      }
    });

    log('Step 3: Navigating to school catchment areas page...');
    await page.goto(LOCRATING_CATCHMENT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    log('Page loaded (domcontentloaded), waiting 5s for iframe...');
    await page.waitForTimeout(5000);

    // Step 4: Find the schoolsmap_osm iframe
    const iframe = page.frame({ url: /schoolsmap_osm/ });
    if (!iframe) {
      logErr('Could not find schoolsmap_osm iframe — taking screenshot');
      await page.screenshot({ path: path.join(DEBUG_DIR, 'locrating-no-iframe.png'), fullPage: true }).catch(() => {});
      await browser.close();
      return {
        success: false,
        areaName: null,
        coordinates: null,
        primarySchools: [],
        secondarySchools: [],
        error: 'Could not find map iframe on Locrating page',
      };
    }
    log('Step 4: Found schoolsmap_osm iframe');

    // Step 5: Dismiss modals and wait for page to settle
    log('Step 5: Dismissing modals...');
    await dismissModals(page, iframe);
    await page.waitForTimeout(2000);

    let lat: number;
    let lng: number;

    // If we have known accurate coordinates (from Postcodes.io / Google),
    // skip the Nominatim geocode entirely — it can land in the wrong LSOA.
    if (knownLat && knownLng) {
      lat = knownLat;
      lng = knownLng;
      log(`Using known coordinates (skipping Nominatim): ${lat}, ${lng}`);
    } else {
      // Fall back to Locrating's Nominatim search flow
      // Step 6: Open the sidebar
      log('Step 6: Opening sidebar...');
      await iframe.evaluate(() => {
        const sidebar = document.querySelector('.ui.sidebar') as HTMLElement | null;
        if (sidebar) {
          sidebar.classList.add('visible');
          sidebar.style.visibility = 'visible';
          sidebar.style.display = 'block';
          sidebar.style.transform = 'translate3d(0, 0, 0)';
        }
        if (typeof (window as any).$ !== 'undefined' && (window as any).$.fn?.sidebar) {
          try { (window as any).$('.ui.sidebar').sidebar('show'); } catch {}
        }
      });
      await page.waitForTimeout(1000);

      // Step 7: Check "Place Home Marker at Location" checkbox
      log('Step 7: Enabling "place home marker" checkbox...');
      await iframe.evaluate(() => {
        const cb = document.querySelector('input[name="addpintomapaftersearch"]') as HTMLInputElement | null;
        if (cb && !cb.checked) {
          cb.checked = true;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      const checkbox = await iframe.$('input[name="addpintomapaftersearch"]');
      if (checkbox) {
        const isChecked = await checkbox.isChecked();
        if (!isChecked) await checkbox.check();
        log('Checkbox checked via Playwright');
      } else {
        log('Checkbox not found in DOM — relying on JS dispatch only');
      }

      // Step 8a: Capture pre-search map center
      const preSearchCoords = await iframe.evaluate(() => {
        if (typeof (window as any).map !== 'undefined' && (window as any).map.getCenter) {
          const c = (window as any).map.getCenter();
          return { lat: c.lat as number, lng: c.lng as number };
        }
        return { lat: 0, lng: 0 };
      });
      log(`Step 8: Pre-search map center: ${preSearchCoords.lat}, ${preSearchCoords.lng}`);

      // Step 8b: Intercept Nominatim geocode response
      let nominatimLat: number | null = null;
      let nominatimLng: number | null = null;
      let nominatimResolved = false;
      context.on('response', async (resp) => {
        const url = resp.url();
        if (url.includes('nominatim')) {
          try {
            const body = await resp.text();
            log(`Nominatim response received (${body.length} bytes) from: ${url}`);
            const jsonMatch = body.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].lat && parsed[0].lon) {
                nominatimLat = parseFloat(parsed[0].lat);
                nominatimLng = parseFloat(parsed[0].lon);
                nominatimResolved = true;
                log(`Nominatim geocoded: ${nominatimLat}, ${nominatimLng} (display_name: ${parsed[0].display_name || 'n/a'})`);
              } else {
                log(`Nominatim returned ${parsed.length} results but none had lat/lon`);
              }
            } else {
              log('Nominatim response not JSONP — raw preview: ' + body.slice(0, 200));
            }
          } catch (e) {
            logErr('Failed to parse Nominatim response', e);
          }
        }
      });

      // Step 9: Type address and trigger search
      log(`Step 9: Typing "${address}" into search input...`);
      const searchInput = await iframe.$('#mapsearch');
      if (searchInput) {
        await searchInput.click();
        await page.waitForTimeout(300);
        await searchInput.evaluate((el: HTMLInputElement) => { el.value = ''; });
        await searchInput.type(address, { delay: 30 });
        await page.waitForTimeout(500);
        await searchInput.press('Enter');
        log('Search input typed and Enter pressed');
      } else {
        log('Search input #mapsearch not found — using JS fallback');
        await iframe.evaluate((addr: string) => {
          const el = document.getElementById('mapsearch') as HTMLInputElement | null;
          if (el) {
            el.value = addr;
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, address);
        await iframe.evaluate(() => {
          const btn = document.getElementById('innerSearchButton');
          if (btn) btn.click();
        });
        log('JS fallback: value set and innerSearchButton clicked');
      }
      log('Step 10: Waiting for geocode to resolve...');

      // Step 10: Wait for coordinates
      let finalLat = 0;
      let finalLng = 0;
      let coordsFound = false;

      for (let i = 0; i < 20; i++) {
        await page.waitForTimeout(1000);

        if (nominatimResolved && nominatimLat && nominatimLng) {
          finalLat = nominatimLat;
          finalLng = nominatimLng;
          coordsFound = true;
          log(`Coords from Nominatim after ${i + 1}s: ${finalLat}, ${finalLng}`);
          await page.waitForTimeout(3000);
          break;
        }

        const currentCoords = await iframe.evaluate(() => {
          const result: Record<string, unknown> = {};
          if (typeof (window as any).homeMarker !== 'undefined' && (window as any).homeMarker?.getLatLng) {
            const ll = (window as any).homeMarker.getLatLng();
            result.homeMarkerLat = ll.lat;
            result.homeMarkerLng = ll.lng;
          }
          if (typeof (window as any).map !== 'undefined' && (window as any).map.getCenter) {
            const c = (window as any).map.getCenter();
            result.mapLat = c.lat;
            result.mapLng = c.lng;
          }
          return result;
        });

        if (currentCoords.homeMarkerLat && currentCoords.homeMarkerLng) {
          finalLat = currentCoords.homeMarkerLat as number;
          finalLng = currentCoords.homeMarkerLng as number;
          coordsFound = true;
          log(`Coords from homeMarker after ${i + 1}s: ${finalLat}, ${finalLng}`);
          await page.waitForTimeout(2000);
          break;
        }

        if (currentCoords.mapLat && currentCoords.mapLng) {
          const mapLat = currentCoords.mapLat as number;
          const mapLng = currentCoords.mapLng as number;
          const moved = Math.abs(mapLat - preSearchCoords.lat) > 0.0001 ||
                         Math.abs(mapLng - preSearchCoords.lng) > 0.0001;
          if (moved) {
            finalLat = mapLat;
            finalLng = mapLng;
            coordsFound = true;
            log(`Coords from map center (moved) after ${i + 1}s: ${finalLat}, ${finalLng}`);
            await page.waitForTimeout(2000);
            break;
          }
          if (i >= 10 && mapLat !== 0) {
            finalLat = mapLat;
            finalLng = mapLng;
            coordsFound = true;
            log(`Coords from map center (static, accepted after ${i + 1}s): ${finalLat}, ${finalLng}`);
            await page.waitForTimeout(1000);
            break;
          }
        }

        if (i % 5 === 4) {
          log(`Still waiting for geocode... (${i + 1}s elapsed, nominatim resolved=${nominatimResolved})`);
        }
      }

      if (!coordsFound) {
        logErr(`Geocode failed after 20s for "${address}". nominatim=${nominatimResolved}`);
        await page.screenshot({ path: path.join(DEBUG_DIR, 'locrating-geocode-failed.png'), fullPage: true }).catch(() => {});
        await saveCookies(context);
        await browser.close();
        return {
          success: false,
          areaName: null,
          coordinates: null,
          primarySchools: [],
          secondarySchools: [],
          error: `Locrating geocode failed for address "${address}". The address may not be recognised.`,
        };
      }

      lat = finalLat;
      lng = finalLng;
    }

    // Step 11: Embed attended_schools.aspx iframe
    log(`Step 11: Embedding attended_schools.aspx at ${lat}, ${lng}...`);
    await page.evaluate(async (params: { lat: number; lng: number }) => {
      return new Promise<void>((resolve) => {
        const existing = document.getElementById('test_attended_frame');
        if (existing) existing.remove();

        const iframe = document.createElement('iframe');
        iframe.id = 'test_attended_frame';
        iframe.style.width = '800px';
        iframe.style.height = '600px';
        iframe.referrerPolicy = 'strict-origin-when-cross-origin';
        iframe.src = `/html5/plugin/attended_schools.aspx?lat=${params.lat}&lng=${params.lng}`;
        document.body.appendChild(iframe);

        iframe.onload = () => setTimeout(resolve, 8000);
        setTimeout(resolve, 15000);
      });
    }, { lat, lng });

    log('Step 11: attended_schools.aspx iframe loaded, waiting 5s for API response...');
    await page.waitForTimeout(5000);

    // Step 12: Parse captured response
    if (!attendedResponse) {
      logErr('No GetAttendedSchools_plugin response captured — taking screenshot');
      await page.screenshot({ path: path.join(DEBUG_DIR, 'locrating-no-api-response.png'), fullPage: true }).catch(() => {});
      await saveCookies(context);
      await browser.close();
      return {
        success: false,
        areaName: null,
        coordinates: { lat, lng },
        primarySchools: [],
        secondarySchools: [],
        error: 'No attended schools data received from Locrating API',
      };
    }

    await fs.writeFile(path.join(DEBUG_DIR, 'attended-schools-raw.json'), attendedResponse, 'utf-8');
    log('Step 12: Parsing API response...');

    const parsed = parseAttendedSchoolsResponse(attendedResponse);

    if (!parsed) {
      logErr('Failed to parse GetAttendedSchools_plugin response');
      await saveCookies(context);
      await browser.close();
      return {
        success: false,
        areaName: null,
        coordinates: { lat, lng },
        primarySchools: [],
        secondarySchools: [],
        error: 'Failed to parse attended schools data from API response',
      };
    }

    log(`Success! Area: "${parsed.areaName}" | ${parsed.primarySchools.length} primary, ${parsed.secondarySchools.length} secondary schools`);

    if (parsed.secondarySchools.length > 0) {
      log('Secondary schools: ' + parsed.secondarySchools.slice(0, 5).map(s => `${s.percentage}% ${s.name}`).join(', '));
    }
    if (parsed.primarySchools.length > 0) {
      log('Primary schools: ' + parsed.primarySchools.slice(0, 5).map(s => `${s.percentage}% ${s.name}`).join(', '));
    }

    await saveCookies(context);
    await browser.close();
    log('Done. Browser closed.');

    return {
      success: true,
      areaName: parsed.areaName,
      coordinates: { lat, lng },
      primarySchools: parsed.primarySchools,
      secondarySchools: parsed.secondarySchools,
    };

  } catch (error) {
    logErr('Unhandled exception in scraper', error);
    if (browser) {
      try { await browser.close(); } catch {}
    }
    return {
      success: false,
      areaName: null,
      coordinates: null,
      primarySchools: [],
      secondarySchools: [],
      error: `Locrating scrape failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
