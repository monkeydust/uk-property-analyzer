import { Property } from '@/lib/types/property';

export type ZenStyle = 'receipt' | 'stacked' | 'editorial' | 'dense';

interface PropertyZenViewProps {
  property: Property;
  style: ZenStyle;
}

// EPC rating color for the small pip (receipt mode) or text color
function epcColor(rating: string | null | undefined): string {
  if (!rating) return 'bg-neutral-300';
  const map: Record<string, string> = {
    A: 'bg-green-600', B: 'bg-green-500', C: 'bg-lime-500',
    D: 'bg-yellow-400', E: 'bg-orange-400', F: 'bg-orange-500', G: 'bg-red-500',
  };
  return map[rating.toUpperCase()] || 'bg-neutral-300';
}

function epcTextColor(rating: string | null | undefined): string {
  if (!rating) return 'text-neutral-400';
  const map: Record<string, string> = {
    A: 'text-green-600', B: 'text-green-500', C: 'text-lime-600',
    D: 'text-yellow-500', E: 'text-orange-400', F: 'text-orange-500', G: 'text-red-500',
  };
  return map[rating.toUpperCase()] || 'text-neutral-400';
}

function epcPercent(rating: string | null | undefined): number {
  if (!rating) return 0;
  const map: Record<string, number> = {
    A: 95, B: 82, C: 70, D: 55, E: 42, F: 28, G: 15,
  };
  return map[rating.toUpperCase()] || 0;
}

function formatPrice(price: number | null, listingType: string): string {
  if (!price) return 'N/A';
  const formatted = `\u00A3${price.toLocaleString()}`;
  return listingType === 'rent' ? `${formatted} pcm` : formatted;
}

function formatStationDistance(station: { walkingTime?: number; walkingDistance?: number }): string {
  const parts: string[] = [];
  if (station.walkingTime) {
    parts.push(`${station.walkingTime} min`);
  }
  if (station.walkingDistance) {
    const miles = (station.walkingDistance / 1609.34).toFixed(1);
    parts.push(`${miles} mi`);
  }
  return parts.join(' \u00B7 ');
}

function buildAddress(property: Property): { line1: string; line2: string } {
  const addr = property.address;
  let line1 = '';
  if (addr.doorNumber) line1 += addr.doorNumber + ' ';
  line1 += addr.displayAddress;

  let line2 = '';
  if (addr.postcode && !line1.includes(addr.postcode)) {
    line2 = addr.postcode;
  }
  return { line1: line1.trim(), line2 };
}

function numberToWord(n: number | null): string {
  if (n === null) return 'N/A';
  const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  return n >= 0 && n <= 10 ? words[n] : String(n);
}

// ─────────────────────────────────────────────────
// STYLE A: Receipt / Spec Sheet
// ─────────────────────────────────────────────────

function ReceiptRow({ label, value }: { label: string; value: string | React.ReactNode }) {
  return (
    <div className="flex items-baseline">
      <span className="shrink-0 text-sm text-neutral-600">{label}</span>
      <span className="flex-grow border-b-2 border-dotted border-neutral-200 mx-2 relative top-[-3px] min-w-[20px]" />
      <span className="shrink-0 text-sm font-medium text-neutral-900 text-right">{value}</span>
    </div>
  );
}

function ReceiptSection({ title }: { title: string }) {
  return <p className="text-[10px] uppercase tracking-[0.25em] text-neutral-400 font-medium mb-4">{title}</p>;
}

function ReceiptDivider() {
  return <div className="border-t border-dashed border-neutral-300 my-6" />;
}

function ZenReceipt({ property }: { property: Property }) {
  const { line1, line2 } = buildAddress(property);
  const fullLocation = line2 ? line2 : '';

  return (
    <div className="max-w-2xl mx-auto bg-white py-10 px-8 sm:px-12 rounded-xl">
      {/* Address */}
      <div className="mb-1">
        <h2 className="text-2xl font-semibold text-neutral-900 tracking-tight">{line1}</h2>
        {fullLocation && (
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-400 mt-1">{fullLocation}</p>
        )}
      </div>

      <ReceiptDivider />

      {/* PRICING */}
      <ReceiptSection title="Pricing" />
      <div className="space-y-2">
        <ReceiptRow label="Asking Price" value={formatPrice(property.price, property.listingType)} />
        {property.priceQualifier && (
          <ReceiptRow label="Price Qualifier" value={property.priceQualifier} />
        )}
        {property.pricePerSqFt && (
          <ReceiptRow label="Price / Sq Ft" value={`\u00A3${property.pricePerSqFt.toLocaleString()}`} />
        )}
        <ReceiptRow label="Listing Type" value={property.listingType === 'rent' ? 'To Rent' : 'For Sale'} />
      </div>

      <ReceiptDivider />

      {/* DETAILS */}
      <ReceiptSection title="Details" />
      <div className="space-y-2">
        <ReceiptRow label="Property Type" value={property.propertyType || 'N/A'} />
        <ReceiptRow label="Bedrooms" value={property.bedrooms !== null ? String(property.bedrooms) : 'N/A'} />
        <ReceiptRow label="Bathrooms" value={property.bathrooms !== null ? String(property.bathrooms) : 'N/A'} />
        <ReceiptRow
          label="Square Footage"
          value={property.squareFootage ? `${property.squareFootage.toLocaleString()} sq ft` : 'N/A'}
        />
        {typeof property.marketData?.data?.ownership?.plotSizeAcres === 'number' && (
          <ReceiptRow
            label="Total area"
            value={
              <span>
                {property.marketData.data.ownership.plotSizeAcres.toFixed(2)} acres
                {property.marketData.data.ownership.plotSizeMethod && property.marketData.data.ownership.plotSizeMethod !== 'address-match-uprn' && (
                  <span className="text-amber-500 ml-0.5" title="Approximate — based on a nearby property on the same street">*</span>
                )}
              </span>
            }
          />
        )}
      </div>

      {/* ENERGY */}
      {(property.epc?.currentRating || property.epc?.potentialRating) && (
        <>
          <ReceiptDivider />
          <ReceiptSection title="Energy" />
          <div className="space-y-2">
            {property.epc?.currentRating && (
              <ReceiptRow
                label="EPC Current"
                value={
                  <span>
                    <span className={`inline-block w-2 h-2 rounded-full ${epcColor(property.epc.currentRating)} mr-1.5`} />
                    {property.epc.currentRating}
                  </span>
                }
              />
            )}
            {property.epc?.potentialRating && (
              <ReceiptRow
                label="EPC Potential"
                value={
                  <span>
                    <span className={`inline-block w-2 h-2 rounded-full ${epcColor(property.epc.potentialRating)} mr-1.5`} />
                    {property.epc.potentialRating}
                  </span>
                }
              />
            )}
          </div>
        </>
      )}

      {/* NEAREST STATIONS */}
      {property.nearestStations && property.nearestStations.length > 0 && (
        <>
          <ReceiptDivider />
          <ReceiptSection title="Nearest Stations" />
          <div className="space-y-2">
            {property.nearestStations.map((station) => (
              <ReceiptRow
                key={station.name}
                label={station.name}
                value={formatStationDistance(station)}
              />
            ))}
          </div>
        </>
      )}

      {/* FEATURES */}
      {property.features.length > 0 && (
        <>
          <ReceiptDivider />
          <ReceiptSection title="Features" />
          <div className="space-y-1.5">
            {property.features.map((feature, i) => (
              <p key={i} className="text-sm text-neutral-700">&middot; {feature}</p>
            ))}
          </div>
        </>
      )}

      {/* DESCRIPTION */}
      {property.description && (
        <>
          <ReceiptDivider />
          <ReceiptSection title="Description" />
          <p className="text-sm text-neutral-700 leading-relaxed">{property.description}</p>
        </>
      )}

      {/* Coordinates */}
      {property.coordinates && (
        <div className="mt-8 pt-4 border-t border-neutral-100">
          <p className="text-xs text-neutral-400">
            {property.coordinates.latitude.toFixed(4)}&deg; N, {Math.abs(property.coordinates.longitude).toFixed(4)}&deg; {property.coordinates.longitude >= 0 ? 'E' : 'W'}
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// STYLE B: Stacked Labels
// ─────────────────────────────────────────────────

function StackedCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-medium mb-1">{label}</p>
      <p className="text-2xl sm:text-3xl font-light text-neutral-900">{value}</p>
      {sub && <p className="text-xs text-neutral-400 mt-1">{sub}</p>}
    </div>
  );
}

function SectionLine({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-medium whitespace-nowrap">{title}</span>
      <span className="flex-1 h-px bg-neutral-300" />
    </div>
  );
}

function ZenStacked({ property }: { property: Property }) {
  const { line1, line2 } = buildAddress(property);

  return (
    <div className="max-w-3xl mx-auto py-10 px-6 sm:px-10">
      {/* Address */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold text-neutral-900 tracking-tight">{line1}</h2>
        {line2 && <p className="text-sm text-neutral-400 mt-1">{line2}</p>}
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-16 gap-y-10 mb-14">
        <StackedCell
          label="Price"
          value={formatPrice(property.price, property.listingType)}
          sub={[property.priceQualifier, property.listingType === 'rent' ? 'To Rent' : 'For Sale'].filter(Boolean).join(' \u00B7 ')}
        />
        {property.pricePerSqFt && (
          <StackedCell label="Price / Sq Ft" value={`\u00A3${property.pricePerSqFt.toLocaleString()}`} />
        )}
        <StackedCell label="Bedrooms" value={property.bedrooms !== null ? String(property.bedrooms) : 'N/A'} />
        <StackedCell label="Bathrooms" value={property.bathrooms !== null ? String(property.bathrooms) : 'N/A'} />
        <StackedCell label="Property Type" value={property.propertyType || 'N/A'} />
        {property.squareFootage && (
          <StackedCell label="Square Footage" value={`${property.squareFootage.toLocaleString()} sq ft`} />
        )}
        {typeof property.marketData?.data?.ownership?.plotSizeAcres === 'number' && (
          <StackedCell
            label="Total area"
            value={`${property.marketData.data.ownership.plotSizeAcres.toFixed(2)} acres${property.marketData.data.ownership.plotSizeMethod && property.marketData.data.ownership.plotSizeMethod !== 'address-match-uprn' ? ' *' : ''}`}
          />
        )}

        {/* EPC Current */}
        {property.epc?.currentRating && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-medium mb-1">EPC Current</p>
            <p className="text-2xl sm:text-3xl font-light text-neutral-900">{property.epc.currentRating}</p>
            <div className="h-1.5 rounded-full bg-neutral-200 overflow-hidden mt-2 max-w-[180px]">
              <div
                className={`h-full rounded-full ${epcColor(property.epc.currentRating)}`}
                style={{ width: `${epcPercent(property.epc.currentRating)}%` }}
              />
            </div>
          </div>
        )}

        {/* EPC Potential */}
        {property.epc?.potentialRating && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-medium mb-1">EPC Potential</p>
            <p className="text-2xl sm:text-3xl font-light text-neutral-900">{property.epc.potentialRating}</p>
            <div className="h-1.5 rounded-full bg-neutral-200 overflow-hidden mt-2 max-w-[180px]">
              <div
                className={`h-full rounded-full ${epcColor(property.epc.potentialRating)}`}
                style={{ width: `${epcPercent(property.epc.potentialRating)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* NEAREST STATIONS */}
      {property.nearestStations && property.nearestStations.length > 0 && (
        <div className="mb-14">
          <SectionLine title="Nearest Stations" />
          <div className="space-y-3">
            {property.nearestStations.map((station) => (
              <p key={station.name} className="text-sm text-neutral-700">
                {station.name} &middot; {formatStationDistance(station)}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* FEATURES */}
      {property.features.length > 0 && (
        <div className="mb-14">
          <SectionLine title="Features" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-16 gap-y-2">
            {property.features.map((feature, i) => (
              <p key={i} className="text-sm text-neutral-700">{feature}</p>
            ))}
          </div>
        </div>
      )}

      {/* DESCRIPTION */}
      {property.description && (
        <div className="mb-10">
          <SectionLine title="Description" />
          <p className="text-sm text-neutral-600 leading-relaxed">{property.description}</p>
        </div>
      )}

      {/* Coordinates */}
      {property.coordinates && (
        <p className="text-xs text-neutral-400">
          {property.coordinates.latitude.toFixed(4)}, {property.coordinates.longitude.toFixed(4)}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// STYLE C: Editorial / Magazine
// ─────────────────────────────────────────────────

function Ornament() {
  return <div className="py-10 text-center text-neutral-300 text-xl tracking-[0.5em]">&middot;</div>;
}

function ZenEditorial({ property }: { property: Property }) {
  const addr = property.address;
  // Split display address into parts for the tapering hero
  const displayParts = addr.displayAddress.split(',').map((s) => s.trim());
  const doorPrefix = addr.doorNumber ? `${addr.doorNumber} ` : '';

  return (
    <div className="max-w-xl mx-auto text-center py-10 px-6">
      {/* Address Hero */}
      <div className="mb-16">
        <h2 className="font-serif text-3xl sm:text-4xl font-medium text-neutral-900 mb-2">
          {doorPrefix}{displayParts[0] || addr.displayAddress}
        </h2>
        {displayParts.slice(1).map((part, i) => (
          <p key={i} className="text-sm text-neutral-400 tracking-wide">{part}</p>
        ))}
        {addr.postcode && !addr.displayAddress.includes(addr.postcode) && (
          <p className="text-sm text-neutral-400 tracking-wide">{addr.postcode}</p>
        )}
      </div>

      {/* Price */}
      <div className="mb-16">
        <p className="font-serif text-4xl sm:text-5xl font-normal text-neutral-900 mb-2">
          {formatPrice(property.price, property.listingType)}
        </p>
        <p className="text-xs text-neutral-400 tracking-wide">
          {[property.priceQualifier, property.listingType === 'rent' ? 'To Rent' : 'For Sale'].filter(Boolean).join(' \u00B7 ')}
        </p>
      </div>

      {/* Key Details */}
      <div className="mb-16">
        <p className="text-sm text-neutral-600 tracking-wide">
          {[
            property.bedrooms !== null ? `${numberToWord(property.bedrooms)} bedroom${property.bedrooms !== 1 ? 's' : ''}` : null,
            property.bathrooms !== null ? `${numberToWord(property.bathrooms)} bathroom${property.bathrooms !== 1 ? 's' : ''}` : null,
            property.squareFootage ? `${property.squareFootage.toLocaleString()} sq ft` : null,
          ].filter(Boolean).join(' \u00B7 ')}
        </p>
        <p className="font-serif text-lg text-neutral-900 mt-2">{property.propertyType || 'Property'}</p>
      </div>

      {/* Description */}
      {property.description && (
        <div className="mb-4 max-w-md mx-auto">
          <p className="text-sm text-neutral-500 leading-relaxed">{property.description}</p>
        </div>
      )}

      {/* Energy */}
      {(property.epc?.currentRating || property.epc?.potentialRating) && (
        <>
          <Ornament />
          <div className="mb-4">
            <p className="font-serif text-lg text-neutral-900 mb-3">Energy</p>
            <p className="text-2xl font-light text-neutral-800 tracking-wider">
              {property.epc?.currentRating && (
                <span className={epcTextColor(property.epc.currentRating)}>{property.epc.currentRating}</span>
              )}
              {property.epc?.currentRating && property.epc?.potentialRating && (
                <span className="text-neutral-300 mx-3">&rarr;</span>
              )}
              {property.epc?.potentialRating && (
                <span className={epcTextColor(property.epc.potentialRating)}>{property.epc.potentialRating}</span>
              )}
            </p>
            {property.epc?.currentRating && property.epc?.potentialRating && (
              <p className="text-xs text-neutral-400 mt-2 tracking-wide">
                Current &nbsp;&nbsp;&nbsp; Potential
              </p>
            )}
          </div>
        </>
      )}

      {/* Stations */}
      {property.nearestStations && property.nearestStations.length > 0 && (
        <>
          <Ornament />
          <div className="mb-4">
            <p className="font-serif text-lg text-neutral-900 mb-8">Getting There</p>
            <div className="space-y-8">
              {property.nearestStations.map((station) => (
                <div key={station.name}>
                  <p className="text-sm font-medium text-neutral-800">{station.name}</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    {station.walkingTime ? `${station.walkingTime} minute walk` : ''}{station.walkingTime && station.walkingDistance ? ' \u00B7 ' : ''}
                    {station.walkingDistance
                      ? `${(station.walkingDistance / 1609.34).toFixed(1)} miles`
                      : '\u2014'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Features */}
      {property.features.length > 0 && (
        <>
          <Ornament />
          <div className="space-y-2 mb-16">
            {property.features.map((feature, i) => (
              <p key={i} className="text-sm text-neutral-500">{feature}</p>
            ))}
          </div>
        </>
      )}

      {/* Footer */}
      <div className="pt-8 border-t border-neutral-100">
        {property.pricePerSqFt && (
          <p className="text-xs text-neutral-400">&pound;{property.pricePerSqFt.toLocaleString()} per square foot</p>
        )}
        {property.coordinates && (
          <p className="text-xs text-neutral-400 mt-1">
            {property.coordinates.latitude.toFixed(4)}&deg; N, {Math.abs(property.coordinates.longitude).toFixed(4)}&deg; {property.coordinates.longitude >= 0 ? 'E' : 'W'}
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// STYLE D: Dense / Terminal
// ─────────────────────────────────────────────────

function epcTagColors(rating: string | null | undefined): string {
  if (!rating) return 'bg-stone-100 text-stone-400';
  const map: Record<string, string> = {
    A: 'bg-green-100 text-green-700', B: 'bg-green-100 text-green-700', C: 'bg-lime-100 text-lime-700',
    D: 'bg-yellow-100 text-yellow-700', E: 'bg-orange-100 text-orange-700', F: 'bg-orange-100 text-orange-700', G: 'bg-red-100 text-red-700',
  };
  return map[rating.toUpperCase()] || 'bg-stone-100 text-stone-400';
}

function DenseRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between py-[3px]">
      <span className="text-[10px] uppercase tracking-[0.05em] text-stone-400">{label}</span>
      <span className="text-xs font-medium text-stone-900">{value}</span>
    </div>
  );
}

function ZenDense({ property }: { property: Property }) {
  const { line1, line2 } = buildAddress(property);
  const addrSuffix = line2 ? `, ${line2}` : '';

  return (
    <div className="max-w-2xl mx-auto bg-white border border-stone-200 rounded-md overflow-hidden font-mono">
      {/* Header bar */}
      <div className="px-4 py-2 bg-stone-800 flex items-baseline justify-between">
        <span className="text-xs font-semibold tracking-wide text-white uppercase">{line1}</span>
        <span className="text-[10px] text-stone-400">{line2 || property.address.displayAddress}{addrSuffix ? '' : ''}</span>
      </div>

      <div className="px-4 py-3 text-xs">
        {/* Price row */}
        <div className="flex items-baseline gap-3 pb-2 mb-2 border-b border-stone-100">
          <span className="text-xl font-semibold text-stone-900">
            {formatPrice(property.price, property.listingType)}
          </span>
          {property.priceQualifier && (
            <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-sm bg-stone-100 text-stone-500 font-medium">
              {property.priceQualifier}
            </span>
          )}
          <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-sm bg-emerald-50 text-emerald-700 font-medium">
            {property.listingType === 'rent' ? 'To Rent' : 'For Sale'}
          </span>
          {property.pricePerSqFt && (
            <span className="ml-auto text-[11px] text-stone-400">
              &pound;{property.pricePerSqFt.toLocaleString()}/sqft
            </span>
          )}
        </div>

        {/* Two-column key stats */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-0 py-2 border-b border-stone-100">
          <DenseRow label="Type" value={property.propertyType || 'N/A'} />
          <DenseRow
            label="Size"
            value={property.squareFootage ? `${property.squareFootage.toLocaleString()} sqft` : 'N/A'}
          />
          <DenseRow label="Beds" value={property.bedrooms !== null ? String(property.bedrooms) : 'N/A'} />
          <DenseRow label="Baths" value={property.bathrooms !== null ? String(property.bathrooms) : 'N/A'} />
          <DenseRow
            label="Total area"
            value={typeof property.marketData?.data?.ownership?.plotSizeAcres === 'number'
              ? `${property.marketData.data.ownership.plotSizeAcres.toFixed(2)} acres${property.marketData.data.ownership.plotSizeMethod && property.marketData.data.ownership.plotSizeMethod !== 'address-match-uprn' ? ' *' : ''}`
              : 'N/A'}
          />
          <DenseRow
            label="EPC"
            value={
              (property.epc?.currentRating || property.epc?.potentialRating) ? (
                <span className="flex items-center gap-1">
                  {property.epc?.currentRating && (
                    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-sm font-medium ${epcTagColors(property.epc.currentRating)}`}>
                      {property.epc.currentRating}
                    </span>
                  )}
                  {property.epc?.currentRating && property.epc?.potentialRating && (
                    <span className="text-stone-300">&rarr;</span>
                  )}
                  {property.epc?.potentialRating && (
                    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-sm font-medium ${epcTagColors(property.epc.potentialRating)}`}>
                      {property.epc.potentialRating}
                    </span>
                  )}
                </span>
              ) : 'N/A'
            }
          />
          {property.coordinates && (
            <DenseRow
              label="Coords"
              value={
                <span className="text-[11px] text-stone-400 font-normal">
                  {property.coordinates.latitude.toFixed(4)}, {property.coordinates.longitude.toFixed(4)}
                </span>
              }
            />
          )}
        </div>

        {/* Stations table */}
        {property.nearestStations && property.nearestStations.length > 0 && (
          <div className="py-2 border-b border-stone-100">
            <p className="text-[10px] uppercase tracking-[0.05em] text-stone-400 mb-1">Stations</p>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-stone-400 text-[9px] uppercase tracking-wider">
                  <th className="text-left font-normal pb-0.5">Name</th>
                  <th className="text-right font-normal pb-0.5 w-14">Walk</th>
                  <th className="text-right font-normal pb-0.5 w-14">Dist</th>
                </tr>
              </thead>
              <tbody className="text-stone-800">
                {property.nearestStations.map((station) => (
                  <tr key={station.name}>
                    <td className="py-0.5 font-medium">{station.name}</td>
                    <td className="py-0.5 text-right">
                      {station.walkingTime ? `${station.walkingTime} min` : '\u2014'}
                    </td>
                    <td className="py-0.5 text-right">
                      {station.walkingDistance
                        ? `${(station.walkingDistance / 1609.34).toFixed(1)} mi`
                        : '\u2014'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Features — inline */}
        {property.features.length > 0 && (
          <div className="py-2 border-b border-stone-100">
            <p className="text-[10px] uppercase tracking-[0.05em] text-stone-400">Features</p>
            <p className="text-[11px] text-stone-700 mt-0.5 leading-relaxed">
              {property.features.join(' \u00B7 ')}
            </p>
          </div>
        )}

        {/* Description */}
        {property.description && (
          <div className="py-2">
            <p className="text-[10px] uppercase tracking-[0.05em] text-stone-400">Description</p>
            <p className="text-[11px] text-stone-600 mt-0.5 leading-relaxed">{property.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────

export default function PropertyZenView({ property, style }: PropertyZenViewProps) {
  switch (style) {
    case 'receipt':
      return <ZenReceipt property={property} />;
    case 'stacked':
      return <ZenStacked property={property} />;
    case 'editorial':
      return <ZenEditorial property={property} />;
    case 'dense':
      return <ZenDense property={property} />;
  }
}
