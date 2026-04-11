
// ── Math helpers ───────────────────────────────────────────
export const DEG = Math.PI / 180;

export function latLonToXYZ(lat, lon, r) {
  const phi = (90 - lat) * DEG;
  const th  = lon * DEG;
  return [
     r * Math.sin(phi) * Math.sin(th),
     r * Math.cos(phi),
    -r * Math.sin(phi) * Math.cos(th),
  ];
}

export function rotY([x, y, z], a) {
  return [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
}
export function rotX([x, y, z], a) {
  return [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
}

export function project([x, y, z], cx, cy, d) {
  const s = d / (d + z + 200);
  return { sx: cx + x * s, sy: cy - y * s, z, s };
}

// ── TopoJSON decoder ───────────────────────────────────────
export function decodeArcs(topoArcs, transform) {
  return topoArcs.map(arc => {
    let x = 0, y = 0;
    return arc.map(d => {
      x += d[0]; y += d[1];
      return [
        x * transform.scale[0] + transform.translate[0],
        y * transform.scale[1] + transform.translate[1],
      ];
    });
  });
}

function resolveRing(indices, decoded) {
  const pts = [];
  for (const idx of indices) {
    const rev = idx < 0;
    const arc = decoded[rev ? ~idx : idx];
    pts.push(...(rev ? [...arc].reverse() : arc));
  }
  return pts;
}

export function getOuterRings(geometry, decoded) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon')      return [resolveRing(geometry.arcs[0], decoded)];
  if (geometry.type === 'MultiPolygon') return geometry.arcs.map(p => resolveRing(p[0], decoded));
  return [];
}

export function getAllRings(geometry, decoded) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon')      return geometry.arcs.map(r => resolveRing(r, decoded));
  if (geometry.type === 'MultiPolygon') return geometry.arcs.flatMap(p => p.map(r => resolveRing(r, decoded)));
  return [];
}

// Build land dot list using canvas rasterization
export function buildLandDots(topo, decoded, step = 2.5) {
  const W = 720, H = 360;
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const ctx = off.getContext('2d');

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';

  for (const geom of (topo.objects.land?.geometries ?? [])) {
    for (const ring of getAllRings(geom, decoded)) {
      ctx.beginPath();
      ring.forEach(([lon, lat], i) => {
        const px = (lon + 180) / 360 * W;
        const py = (90 - lat) / 180 * H;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fill();
    }
  }

  const data = ctx.getImageData(0, 0, W, H).data;
  const isLand = (lat, lon) => {
    const px = Math.min(W - 1, Math.max(0, Math.round((lon + 180) / 360 * W)));
    const py = Math.min(H - 1, Math.max(0, Math.round((90 - lat) / 180 * H)));
    return data[(py * W + px) * 4] > 128;
  };

  const dots = [];
  for (let lat = -88; lat <= 88; lat += step)
    for (let lon = -178; lon <= 178; lon += step)
      if (isLand(lat, lon)) dots.push([lat, lon]);

  return dots;
}

// ── 3-D arc (node → hub) ───────────────────────────────────
export function buildArc(lat1, lon1, lat2, lon2, R, lift = 0.3, n = 60) {
  const p1 = latLonToXYZ(lat1, lon1, R);
  const p2 = latLonToXYZ(lat2, lon2, R);
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    let x = p1[0] * (1 - t) + p2[0] * t;
    let y = p1[1] * (1 - t) + p2[1] * t;
    let z = p1[2] * (1 - t) + p2[2] * t;
    const len = Math.sqrt(x * x + y * y + z * z);
    const f   = R * (1 + lift * Math.sin(t * Math.PI)) / len;
    return [x * f, y * f, z * f];
  });
}

// ── Country label data ─────────────────────────────────────
// [ISO-numeric]: [name, lon, lat]
export const COUNTRY_LABELS = {
  '004': ['Afghanistan',    67.709953,  33.93911],
  '012': ['Algeria',         1.659626,  28.033886],
  '024': ['Angola',         17.873887, -11.202692],
  '032': ['Argentina',     -63.616672, -38.416097],
  '036': ['Australia',     133.775136, -25.274398],
  '040': ['Austria',        14.550072,  47.516231],
  '050': ['Bangladesh',     90.356331,  23.684994],
  '076': ['Brazil',        -51.92528,  -14.235004],
  '100': ['Bulgaria',       25.48583,   42.733883],
  '124': ['Canada',       -106.346771,  56.130366],
  '152': ['Chile',         -71.542969, -35.675147],
  '156': ['China',         104.195397,  35.86166],
  '170': ['Colombia',      -74.297333,   4.570868],
  '818': ['Egypt',          30.802498,  26.820553],
  '231': ['Ethiopia',       40.489673,   9.145],
  '246': ['Finland',        25.748151,  61.92411],
  '250': ['France',          2.213749,  46.227638],
  '276': ['Germany',        10.451526,  51.165691],
  '288': ['Ghana',          -1.023194,   7.946527],
  '300': ['Greece',         21.824312,  39.074208],
  '364': ['Iran',           53.688046,  32.427908],
  '368': ['Iraq',           43.679291,  33.223191],
  '380': ['Italy',          12.56738,   41.87194],
  '392': ['Japan',         138.252924,  36.204824],
  '398': ['Kazakhstan',     66.923684,  48.019573],
  '404': ['Kenya',          37.906193,  -0.023559],
  '410': ['S. Korea',      127.766922,  35.907757],
  '434': ['Libya',          17.228331,  26.3351],
  '484': ['Mexico',       -102.552784,  23.634501],
  '504': ['Morocco',        -7.09262,   31.791702],
  '508': ['Mozambique',     35.529562, -18.665695],
  '524': ['Nepal',          84.124008,  28.394857],
  '528': ['Netherlands',     5.291266,  52.132633],
  '566': ['Nigeria',         8.675277,   9.081999],
  '578': ['Norway',          8.468946,  60.472024],
  '598': ['Papua NG',      143.95555,   -6.314993],
  '604': ['Peru',          -75.015152,  -9.189967],
  '608': ['Philippines',   121.774017,  12.879721],
  '616': ['Poland',         19.145136,  51.919438],
  '620': ['Portugal',       -8.224454,  39.399872],
  '642': ['Romania',        24.96676,   45.943161],
  '643': ['Russia',        105.318756,  61.52401],
  '682': ['Saudi Arabia',   45.079162,  23.885942],
  '706': ['Somalia',        46.199616,   5.152149],
  '710': ['South Africa',   22.937506, -30.559482],
  '724': ['Spain',          -3.74922,   40.463667],
  '752': ['Sweden',         18.643501,  60.128161],
  '756': ['Switzerland',     8.227512,  46.818188],
  '760': ['Syria',          38.996815,  34.802075],
  '764': ['Thailand',      100.992541,  15.870032],
  '788': ['Tunisia',         9.537499,  33.886917],
  '792': ['Turkey',         35.243322,  38.963745],
  '800': ['Uganda',         32.290275,   1.373333],
  '804': ['Ukraine',        31.16558,   48.379433],
  '784': ['UAE',            53.847818,  23.424076],
  '826': ['UK',             -3.435973,  55.378051],
  '840': ['USA',           -95.712891,  37.09024],
  '858': ['Uruguay',       -55.765835, -32.522779],
  '860': ['Uzbekistan',     64.585262,  41.377491],
  '862': ['Venezuela',     -66.58973,    6.42375],
  '704': ['Vietnam',       108.277199,  14.058324],
  '887': ['Yemen',          48.516388,  15.552727],
  '894': ['Zambia',         27.849332, -13.133897],
  '716': ['Zimbabwe',       29.154857, -19.015438],
  '450': ['Madagascar',     46.869107, -18.766947],
  '218': ['Ecuador',       -78.183406,  -1.831239],
  '068': ['Bolivia',       -63.588653, -16.290154],
  '729': ['Sudan',          30.217636,  12.862807],
  '072': ['Botswana',       24.684866, -22.328474],
  '020': ['Andorra',         1.601554,  42.546245],
  '008': ['Albania',        20.168331,  41.153332],
  '028': ['Antigua & Barb.', -61.796428, 17.060816],
  '051': ['Armenia',        45.038189,  40.069099],
  '031': ['Azerbaijan',     47.576927,  40.143105],
  '044': ['Bahamas',       -77.39628,   25.03428],
  '048': ['Bahrain',        50.637772,  25.930414],
  '052': ['Barbados',      -59.543198,  13.193887],
  '112': ['Belarus',        27.953389,  53.709807],
  '056': ['Belgium',         4.469936,  50.503887],
  '084': ['Belize',        -88.49765,   17.189877],
  '204': ['Benin',           2.315834,   9.30769],
  '064': ['Bhutan',         90.433601,  27.514162],
  '070': ['Bosnia & Herz.', 17.679076,  43.915886],
  '096': ['Brunei',        114.727669,   4.535277],
  '854': ['Burkina Faso',   -1.561593,  12.238333],
  '108': ['Burundi',        29.918886,  -3.373056],
  '132': ['Cabo Verde',    -24.013197,  16.002082],
  '116': ['Cambodia',      104.990963,  12.565679],
  '120': ['Cameroon',       12.354722,   7.369722],
  '140': ['CAR',            20.939444,   6.611111], // Central African Republic
  '148': ['Chad',           18.732207,  15.454166],
  '174': ['Comoros',        43.872219, -11.875001],
  '178': ['Congo',          15.827659,  -0.228021],
  '180': ['DR Congo',       21.758664,  -4.038333],
  '188': ['Costa Rica',    -83.753428,   9.748917],
  '191': ['Croatia',        15.2,       45.1],
  '192': ['Cuba',          -77.781167,  21.521757],
  '196': ['Cyprus',         33.429859,  35.126413],
  '203': ['Czechia',        15.472962,  49.817492],
  '208': ['Denmark',         9.501785,  56.26392],
  '262': ['Djibouti',       42.590275,  11.825138],
  '214': ['Dominican Rep.',-70.162651,  18.735693],
  '222': ['El Salvador',   -88.89653,   13.794185],
  '226': ['Equatorial Guinea', 10.267895, 1.650801],
  '232': ['Eritrea',        39.782334,  15.179384],
  '233': ['Estonia',        25.013607,  58.595272],
  '748': ['Eswatini',       31.465866, -26.522503],
  '242': ['Fiji',          179.414413, -16.578193],
  '266': ['Gabon',          11.609444,  -0.803689],
  '270': ['Gambia',        -15.310139,  13.443182],
  '268': ['Georgia',        43.356892,  42.315407],
  '308': ['Grenada',       -61.604171,  12.262776],
  '320': ['Guatemala',     -90.230759,  15.783471],
  '324': ['Guinea',         -9.696645,   9.945587],
  '624': ['Guinea-Bissau', -15.180413,  11.803749],
  '328': ['Guyana',        -58.93018,    4.860416],
  '332': ['Haiti',         -72.285215,  18.971187],
  '340': ['Honduras',      -86.241905,  15.199999],
  '348': ['Hungary',        19.503304,  47.162494],
  '352': ['Iceland',       -19.020835,  64.963051],
  '356': ['India',          78.96288,   20.593684],
  '360': ['Indonesia',     113.921327,  -0.789275],
  '372': ['Ireland',        -8.24389,   53.41291],
  '376': ['Israel',         34.851612,  31.046051],
  '384': ['Ivory Coast',    -5.54708,    7.539989],
  '388': ['Jamaica',       -77.297508,  18.109581],
  '400': ['Jordan',         36.238414,  30.585164],
  '296': ['Kiribati',     -168.734039,  -3.370417],
  '414': ['Kuwait',         47.481766,  29.31166],
  '417': ['Kyrgyzstan',     74.766098,  41.20438],
  '418': ['Laos',          102.495496,  19.85627],
  '428': ['Latvia',         24.603189,  56.879635],
  '422': ['Lebanon',        35.862285,  33.854721],
  '426': ['Lesotho',        28.233608, -29.609988],
  '430': ['Liberia',        -9.429499,   6.428055],
  '438': ['Liechtenstein',   9.555373,  47.166],
  '440': ['Lithuania',      23.881275,  55.169438],
  '442': ['Luxembourg',      6.129583,  49.815273],
  '454': ['Malawi',         34.301525, -13.254308],
  '458': ['Malaysia',      101.975766,   4.210484],
  '462': ['Maldives',       73.22068,    3.202778],
  '466': ['Mali',           -3.996166,  17.570692],
  '470': ['Malta',          14.375416,  35.937496],
  '584': ['Marshall Islands',171.184478, 7.131474],
  '478': ['Mauritania',    -10.940835,  21.00789],
  '480': ['Mauritius',      57.552152, -20.348404],
  '583': ['Micronesia',    150.550812,   7.425554],
  '498': ['Moldova',        28.369885,  47.411631],
  '492': ['Monaco',          7.412841,  43.750298],
  '496': ['Mongolia',      103.846656,  46.862496],
  '499': ['Montenegro',     19.37439,   42.708678],
  '104': ['Myanmar',        95.956223,  21.913965],
  '516': ['Namibia',        18.49041,  -22.95764],
  '520': ['Nauru',         166.931503,  -0.522778],
  '554': ['New Zealand',   174.885971, -40.900557],
  '558': ['Nicaragua',     -85.207229,  12.865416],
  '562': ['Niger',           8.081666,  17.607789],
  '408': ['North Korea',   127.510093,  40.339852],
  '807': ['North Macedonia', 21.745275,  41.608635],
  '512': ['Oman',           55.923255,  21.512583],
  '586': ['Pakistan',       69.345116,  30.375321],
  '585': ['Palau',         134.58252,    7.51498],
  '275': ['Palestine',      35.233154,  31.952162],
  '591': ['Panama',        -80.782127,   8.537981],
  '600': ['Paraguay',      -58.443832, -23.442503],
  '634': ['Qatar',          51.183884,  25.354826],
  '646': ['Rwanda',         29.873888,  -1.940278],
  '659': ['Saint Kitts',   -62.782998,  17.357822],
  '662': ['Saint Lucia',   -60.978893,  13.909444],
  '670': ['Saint Vincent', -61.287228,  12.984305],
  '882': ['Samoa',        -172.104629, -13.759029],
  '674': ['San Marino',     12.457777,  43.94236],
  '678': ['Sao Tome',        6.613081,   0.18636],
  '686': ['Senegal',       -14.452362,  14.497401],
  '688': ['Serbia',         21.005859,  44.016521],
  '690': ['Seychelles',     55.491977,  -4.679574],
  '694': ['Sierra Leone',  -11.779889,   8.460555],
  '702': ['Singapore',     103.819836,   1.352083],
  '703': ['Slovakia',       19.699024,  48.669026],
  '705': ['Slovenia',       14.995463,  46.151241],
  '090': ['Solomon Islands',160.156194, -9.64571],
  '728': ['South Sudan',    31.3,        6.9],
  '144': ['Sri Lanka',      80.771797,   7.873054],
  '740': ['Suriname',      -56.027783,   3.919305],
  '158': ['Taiwan',        120.960515,  23.69781],
  '762': ['Tajikistan',     71.276093,  38.861034],
  '834': ['Tanzania',       34.888822,  -6.369028],
  '768': ['Togo',            0.824782,   8.619543],
  '776': ['Tonga',        -175.198242, -21.178986],
  '780': ['Trinidad/Tobago',-61.222503,  10.691803],
  '795': ['Turkmenistan',   59.556278,  38.969719],
  '798': ['Tuvalu',        177.64933,   -7.109535],
  '548': ['Vanuatu',       166.959158, -15.376706],
  '336': ['Vatican City',   12.453389,  41.902916],
  '660': ['Anguilla',         -63.0686,   18.2205],
  '010': ['Antarctica',       0.0000,    -90.0000],
  '016': ['American Samoa',   -170.7300, -14.2700],
  '533': ['Aruba',            -69.9600,   12.5200],
  '248': ['Åland Islands',    20.0000,    60.1100],
  '652': ['Saint Barthélemy', -62.8300,   17.9000],
  '060': ['Bermuda',          -64.7500,   32.3000],
  '535': ['Caribbean Netherlands', -68.2600, 12.2000],
  '074': ['Bouvet Island',    3.4000,    -54.4200],
  '166': ['Cocos Islands',    96.8700,    -12.1600],
  '184': ['Cook Islands',    -159.7700,  -21.2300],
  '531': ['Curaçao',          -68.9900,   12.1600],
  '162': ['Christmas Island', 105.6900,  -10.4400],
  '212': ['Dominica',         -61.3700,   15.4100],
  '732': ['Western Sahara',   -12.8800,   24.2100],
  '238': ['Falkland Islands', -59.5200,  -51.7900],
  '234': ['Faroe Islands',    -6.9100,    61.8900],
  '254': ['French Guiana',    -53.1200,    3.9300],
  '831': ['Guernsey',         -2.5800,    49.4600],
  '292': ['Gibraltar',        -5.3500,    36.1400],
  '304': ['Greenland',        -42.6000,   71.7000],
  '312': ['Guadeloupe',       -61.5500,   16.2600],
  '239': ['South Georgia',    -36.5800,  -54.2800],
  '316': ['Guam',             144.7900,   13.4400],
  '344': ['Hong Kong',        114.1600,   22.3100],
  '334': ['Heard Island',     73.5000,   -53.1000],
  '833': ['Isle of Man',      -4.5400,    54.2300],
  '086': ['British Indian Ocean Territory', 71.8700, -6.3400],
  '832': ['Jersey',           -2.1300,    49.2100],
  '136': ['Cayman Islands',   -80.5600,   19.3200],
  '663': ['Saint Martin',     -63.0500,   18.0700],
  '446': ['Macau',            113.5400,   22.1900],
  '580': ['Northern Mariana Islands', 145.7600, 15.0900],
  '474': ['Martinique',       -61.0200,   14.6400],
  '500': ['Montserrat',       -62.1800,   16.7400],
  '540': ['New Caledonia',    165.6100,  -20.9000],
  '574': ['Norfolk Island',   167.9500,  -29.0400],
  '570': ['Niue',             -169.8600, -19.0500],
  '258': ['French Polynesia', -149.4000, -17.6700],
  '666': ['Saint Pierre and Miquelon', -56.2700, 46.8800],
  '612': ['Pitcairn Islands', -130.1000, -25.0600],
  '630': ['Puerto Rico',      -66.5900,   18.2200],
  '638': ['Réunion',          55.5300,   -21.1100],
  '654': ['Saint Helena',     -5.7000,   -15.9600],
  '744': ['Svalbard and Jan Mayen', 23.6700, 77.5500],
  '534': ['Sint Maarten',     -63.0500,   18.0400],
  '796': ['Turks and Caicos Islands', -71.7900, 21.6900],
  '260': ['French Southern Territories', 69.3400, -49.2800],
  '772': ['Tokelau',          -171.8500,  -8.9600],
  '626': ['Timor-Leste',       125.7200,  -8.8700],
  '581': ['U.S. Minor Outlying Islands', 166.6000, 19.3000],
  '092': ['British Virgin Islands', -64.6300, 18.4200],
  '850': ['U.S. Virgin Islands', -64.8900, 18.3300],
  '876': ['Wallis and Futun', -176.2000, -13.3000],
  '383': ['Kosovo',            20.9000,   42.6000],
  '175': ['Mayotte',           45.1600,  -12.8200],
};

// Node status → colors
export function getNodeColors(status) {
  if (status === 'online')  return { border: '#22c55e', arc: 'rgba(34,197,94,',  glow: '#22c55e' };
  if (status === 'offline') return { border: '#4b5563', arc: 'rgba(75,85,99,',   glow: '#374151' };
  return                           { border: '#eab308', arc: 'rgba(234,179,8,',  glow: '#eab308' };
}
