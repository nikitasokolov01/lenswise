import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeHtml,
  framesDataSearchUrl,
  highResolutionFrameImagePath,
  EXPANDED_CATALOG_TARGETS,
  MODERN_OPTICAL_COLLECTIONS,
  parseFrameDetails,
  parseSearchFrameIds,
  sanitizeCatalogItemForImport,
  splitSetCookieHeader,
  stripHtml,
} from "./frames-data-web-import.mjs";

test("decodes and strips Frames Data HTML", () => {
  assert.equal(decodeHtml("A &amp; B&nbsp;&#x27;"), "A & B '");
  assert.equal(stripHtml("Modern<br>Optical &amp; Co."), "Modern\nOptical & Co.");
});

test("extracts stable frame IDs from search results", () => {
  const html = `
    <div class="SrchResultsThumbCntnr" frameid="376220" featured="F"></div>
    <div class="SrchResultsThumbCntnr" frameid='376221' featured="F"></div>
  `;
  assert.deepEqual(parseSearchFrameIds(html), ["376220", "376221"]);
});

test("splits combined set-cookie headers without splitting Expires", () => {
  const values = splitSetCookieHeader(
    "ASP.NET_SessionId=abc; path=/; HttpOnly, auth=xyz; expires=Wed, 21 Oct 2030 07:28:00 GMT; path=/"
  );
  assert.equal(values.length, 2);
  assert.match(values[0], /^ASP\.NET_SessionId=abc/);
  assert.match(values[1], /^ auth=xyz/);
});

test("uses the larger Frames Data detail image path", () => {
  assert.equal(
    highResolutionFrameImagePath("/ColorSm/275/2756F054.jpg"),
    "/Q120WEB/color_b/275/2756F054.jpg"
  );
  assert.equal(
    highResolutionFrameImagePath("/Q120WEB/color_b/275/2756F054.jpg"),
    "/Q120WEB/color_b/275/2756F054.jpg"
  );
});

test("targets the requested Modern Optical collections by stable ID", () => {
  assert.deepEqual(
    MODERN_OPTICAL_COLLECTIONS.map(({ id, name }) => [id, name]),
    [
      ["10800", "Genevieve Paris Design"],
      ["1088", "Genevieve Boutique"],
      ["1089", "Giovani di Venezia"],
      ["2585", "Modern Metals"],
      ["10611", "Modern Plastics I"],
      ["11559", "Modern Plastics II"],
      ["2899", "ModZ"],
    ]
  );

  const url = framesDataSearchUrl({
    username: "licensed-user",
    collectionId: "10800",
    page: 2,
  });
  assert.equal(url.searchParams.get("args[Filter][CollectionIDs]"), "10800");
  assert.equal(url.searchParams.get("args[Filter][Keyword]"), "");
  assert.equal(url.searchParams.get("args[Filter][Page]"), "2");
});

test("targets the expanded office catalog and the full Silhouette brand", () => {
  assert.equal(EXPANDED_CATALOG_TARGETS.length, 38);
  assert.deepEqual(EXPANDED_CATALOG_TARGETS.at(-1), {
    filter: "brand",
    id: "4725",
    name: "Silhouette",
  });
  assert.deepEqual(
    EXPANDED_CATALOG_TARGETS.slice(0, -1).every(
      (target) => target.filter === "collection"
    ),
    true
  );

  const url = framesDataSearchUrl({
    username: "licensed-user",
    brandId: "4725",
    page: 1,
  });
  assert.equal(url.searchParams.get("args[Filter][BrandIDs]"), "4725");
  assert.equal(url.searchParams.get("args[Filter][CollectionIDs]"), "");
});

test("sanitizes source outliers before sending a catalog batch", () => {
  const item = sanitizeCatalogItemForImport({
    providerItemId: "frame:color:size",
    manufacturer: "A".repeat(130),
    brand: "Example",
    collection: "Collection",
    model: "Model",
    colorCode: null,
    colorName: null,
    sku: null,
    upc: null,
    eyeSizeMm: 0,
    bridgeSizeMm: 42,
    templeLengthMm: 145,
    aMeasurementMm: 0,
    bMeasurementMm: 46.5,
    effectiveDiameterMm: 121,
    gender: null,
    material: null,
    shape: null,
    frameType: null,
    rimType: null,
    wholesalePriceCents: null,
    suggestedRetailPriceCents: null,
    imageUrl: null,
    isActive: true,
    sourceStatus: "active",
    sourceUpdatedAt: null,
    rawData: {},
  });

  assert.equal(item.manufacturer.length, 120);
  assert.equal(item.eyeSizeMm, null);
  assert.equal(item.bridgeSizeMm, null);
  assert.equal(item.templeLengthMm, 145);
  assert.equal(item.aMeasurementMm, null);
  assert.equal(item.bMeasurementMm, 46.5);
  assert.equal(item.effectiveDiameterMm, null);
});

test("groups a full manufacturer catalog under its requested brand", () => {
  const html = `
    <div id="divFrmTtl">
      Style: 5521<br>
      Silhouette<br>
      Titan Next Generation
    </div>
    <div id="divFrmEySz">
      <table>
        <tr><th>Eye</th><th>A</th><th>B</th><th>DBL</th><th>ED</th><th>Temple</th><th>Bridge</th><th>Circ</th></tr>
        <tr><td>52</td><td>52</td><td>38</td><td>17</td><td>54</td><td>140</td><td>17</td><td>140</td></tr>
      </table>
    </div>
    <img class="img_detail_large" src="/Q120WEB/color_b/example.jpg">
  `;

  const [item] = parseFrameDetails(html, "123", null, "Silhouette");
  assert.equal(item.manufacturer, "Silhouette");
  assert.equal(item.brand, "Silhouette");
  assert.equal(item.collection, "Titan Next Generation");
  assert.equal(item.rawData.catalogBrand, "Titan Next Generation");
});

test("normalizes colors, measurements, and construction details", () => {
  const html = `
    <div id="divFrmTtl">Style: A358<br><span>Modern Optical</span><br><span>Modern Art</span></div>
    <div id="divFrmEySz">
      <table>
        <tr><td>Eye Size</td><td>A</td><td>B</td><td>DBL</td><td>ED</td><td>Temple</td><td>Bridge</td><td>Circ</td></tr>
        <tr><td>54</td><td>54</td><td>37.3</td><td>18.00</td><td>58</td><td>140</td><td>18</td><td>152.9</td></tr>
      </table>
    </div>
    <div id="divFrmInfo">
      <table>
        <tr><td>Gender:</td><td>Female</td></tr>
        <tr><td>Product Group:</td><td>Metal</td></tr>
        <tr><td>Material:</td><td>Metal</td></tr>
        <tr><td>Shape:</td><td>Modified Oval</td></tr>
        <tr><td>Rim:</td><td>Semi-Rimless</td></tr>
      </table>
    </div>
    <div class="ImgThumbCntnr">
      <img class="img_detail_thumb" src="/ColorSm/275/2756F054.jpg">
      <div class="ImgThumbText" title="burgundy">burgundy</div>
    </div>
    <div class="ImgThumbCntnr">
      <img class="img_detail_thumb" src="/ColorSm/275/2756G054.jpg">
      <div class="ImgThumbText" title="gold">gold</div>
    </div>
  `;

  const items = parseFrameDetails(html, "376220", "Modern Metals");
  assert.equal(items.length, 2);
  assert.deepEqual(
    {
      id: items[0].providerItemId,
      manufacturer: items[0].manufacturer,
      brand: items[0].brand,
      model: items[0].model,
      color: items[0].colorName,
      eye: items[0].eyeSizeMm,
      bridge: items[0].bridgeSizeMm,
      temple: items[0].templeLengthMm,
      b: items[0].bMeasurementMm,
      material: items[0].material,
      shape: items[0].shape,
      rim: items[0].rimType,
      collection: items[0].collection,
    },
    {
      id: "376220:2756F054:54-18-140:1",
      manufacturer: "Modern Optical",
      brand: "Modern Art",
      model: "A358",
      color: "burgundy",
      eye: 54,
      bridge: 18,
      temple: 140,
      b: 37.3,
      material: "Metal",
      shape: "Modified Oval",
      rim: "Semi-Rimless",
      collection: "Modern Metals",
    }
  );
  assert.equal(items[1].colorName, "gold");
  assert.equal(items[0].wholesalePriceCents, null);
  assert.equal(items[0].upc, null);
  assert.equal(
    items[0].imageUrl,
    "https://www.framesdata.com/Q120WEB/color_b/275/2756F054.jpg"
  );
});
