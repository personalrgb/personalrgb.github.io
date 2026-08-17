const scene = document.querySelector('.scene');

// 900px 기준으로 설계된 모빌을 화면 크기에 맞춰 축소/확대한다(반응형 대응).
// 개체 자체가 눌리지 않도록 가로세로 항상 같은 비율(uniform)로만 축소한다.
// 모바일(세로 화면)에서는 화면을 덜 채워서 가로 여백을 확실히 남긴다.
const SCENE_DESIGN_SIZE = 900;
const RESPONSIVE_FILL_RATIO = 0.8;
const MOBILE_RESPONSIVE_FILL_RATIO = 1.0;
let currentResponsiveScale = 1;
function updateResponsiveScale() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const fillRatio = w < h ? MOBILE_RESPONSIVE_FILL_RATIO : RESPONSIVE_FILL_RATIO;
  const scale = Math.min(1, (Math.min(w, h) * fillRatio) / SCENE_DESIGN_SIZE);
  currentResponsiveScale = scale;
  scene.style.setProperty('--rs', scale.toFixed(4));

  // 모바일(세로 화면)에서는 상단 톤 버튼 아래부터 하단 튜토리얼 버튼 위까지의
  // 정중앙에 오도록 해서, 위/아래 여백이 똑같아 보이게 한다.
  // (toneButtonsEl/tutorialButtonEl은 이 함수보다 뒤에서 선언되므로 직접 조회한다.)
  const MOBILE_VERTICAL_NUDGE = 0;
  if (w < h) {
    const toneEl = document.querySelector('.tone-buttons');
    const tutEl = document.getElementById('tutorialButton');
    if (toneEl && tutEl) {
      const topBound = toneEl.getBoundingClientRect().bottom;
      const bottomBound = tutEl.getBoundingClientRect().top;
      const centerY = (topBound + bottomBound) / 2 - MOBILE_VERTICAL_NUDGE;
      scene.style.setProperty('--rest-top', `${((centerY / h) * 100).toFixed(2)}%`);
    }
  } else {
    scene.style.removeProperty('--rest-top');
  }
}
updateResponsiveScale();

// 화면 비율(가로/세로)에 맞춰 개체들의 "배치 위치"만 재구성한다(개체 자체 크기/모양은 그대로).
// - 데스크톱(가로 화면): 세로 퍼짐이 너무 좁아지지 않도록 축소 폭에 하한을 둔다.
// - 모바일(세로 화면): 세로 퍼짐을 크게 늘리되, 상단/하단에 여백이 남도록 살짝 덜 채운다.
const viewportAspect = window.innerWidth / window.innerHeight; // 1보다 작으면 세로가 더 긴 화면
const isPortraitViewport = viewportAspect < 1;

// 모바일에서 위아래 여백으로 남겨둘 비율(퍼센트 기반이라 화면 크기가 바뀌어도 항상 비율로 유지된다).
const MOBILE_VERTICAL_MARGIN_RATIO = 0.86;
// 모바일에서 개체들이 더 뭉쳐 보이도록 가로/세로 퍼짐을 한 번 더 줄이는 배율.
const MOBILE_COHESION_FACTOR = 0.72;
// 모바일에서 가로는 더 넓게, 세로는 더 좁게(중앙으로 몰리게) 따로 보정하는 배율.
const MOBILE_HORIZONTAL_BOOST = 1.4;
const MOBILE_VERTICAL_SHRINK = 1.0;

function computeSpreadFactors() {
  const aspect = window.innerWidth / window.innerHeight;
  if (aspect < 1) {
    const aspectClamped = Math.max(0.4, aspect);
    const h = Math.max(0.25, Math.sqrt(aspectClamped)) * MOBILE_COHESION_FACTOR * MOBILE_HORIZONTAL_BOOST;
    // 상단 버튼 아래부터 화면 하단 가까이까지 채우되, 위아래 여백만큼은 덜 채운다.
    const v = Math.min(5, Math.sqrt(1 / aspectClamped) * 3) * MOBILE_VERTICAL_MARGIN_RATIO * MOBILE_COHESION_FACTOR * MOBILE_VERTICAL_SHRINK;
    return { horizontalSpreadFactor: h, verticalSpreadFactor: v };
  }
  const aspectClamped = Math.min(1.8, aspect);
  // 가로는 더 좁혀서 좌우 여백을 넓히고, 세로는 더 늘려서 간격을 넓힌다.
  const h = Math.sqrt(aspectClamped) * 0.8;
  const v = Math.max(1.15, Math.sqrt(1 / aspectClamped) * 1.2);
  return { horizontalSpreadFactor: h, verticalSpreadFactor: v };
}

function computeGeometryConstants(spread) {
  return {
    BASE_RADIUS: 400 * MOBILE_SCALE * spread.horizontalSpreadFactor,
    RADIUS_VARIANCE: 220 * MOBILE_SCALE * spread.horizontalSpreadFactor,
    HEIGHT_RANGE: 320 * MOBILE_SCALE * 0.9 * spread.verticalSpreadFactor,
  };
}

let { horizontalSpreadFactor, verticalSpreadFactor } = computeSpreadFactors();

const toneButtonsEl = document.querySelector('.tone-buttons');

// 개체가 화면 밖으로 넘어가거나 상단 톤 버튼 텍스트 영역까지 올라오지 않도록,
// 위/아래로 이동 가능한 최대 폭(디자인 단위)을 화면 크기에 맞춰 항상 다시 계산해서 못박아 둔다.
function computeVerticalYOffsetLimits() {
  const viewportH = window.innerHeight;
  // 모바일에서는 모빌 자체를 화면 중앙(50%)이 아니라 위/아래 여백에 맞춰 살짝
  // 옮겨두므로(--rest-top), 그 실제 렌더링 중심을 기준으로 위/아래 여유를
  // 계산해야 한다. 50%로 고정해두면 실제 중심이 더 위로 올라간 만큼 위쪽으로
  // 더 움직일 수 있다고 잘못 계산되어 개체들이 상단에 몰려 보인다.
  const sceneRect = scene.getBoundingClientRect();
  const centerY = sceneRect.height > 0 ? sceneRect.top + sceneRect.height / 2 : viewportH / 2;
  const topRect = toneButtonsEl ? toneButtonsEl.getBoundingClientRect() : null;
  const topSafePx = (topRect && topRect.height > 0 ? topRect.bottom : 60) + 20; // 버튼 아래 + 여유
  const bottomSafePx = 28; // 화면 하단 여백

  // 원근 투영 때문에 카메라에 가까운 개체는 같은 yOffset이라도 화면에서 더 크게 움직여 보이므로
  // 넉넉한 안전 계수를 곱해 어떤 경우에도 여백을 넘지 않게 한다.
  const SAFETY = 0.78;
  const rs = Math.max(0.05, currentResponsiveScale);

  const maxUp = Math.max(30, ((centerY - topSafePx) / rs) * SAFETY);
  const maxDown = Math.max(30, ((viewportH - centerY - bottomSafePx) / rs) * SAFETY);
  return { maxUp, maxDown };
}

function clampYOffset(yOffset, limits) {
  return Math.max(-limits.maxUp, Math.min(limits.maxDown, yOffset));
}

// 위/아래 끝으로 갈수록 가로 반지름을 줄여, 모빌(mobile 조형물)처럼 위아래는 좁고
// 가운데는 볼록한 마름모 실루엣을 만든다. 다만 개체마다 타이핑 강도와 곡선(지수)을
// 조금씩 다르게 흔들어서, 매끈하고 딱 떨어지는 기하학적 다이아몬드가 아니라
// 자연스럽고 유기적인 윤곽이 되게 한다.
function rhombusTaper(yOffset, limits, seedBase) {
  const vLimit = yOffset >= 0 ? limits.maxDown : limits.maxUp;
  const vNorm = vLimit > 0 ? Math.min(1, Math.abs(yOffset) / vLimit) : 0;
  const strengthJitter = 0.6 + seeded(seedBase + 521) * 0.7; // 0.6~1.3
  const curveJitter = 1.0 + seeded(seedBase + 613) * 1.0;    // 1.0~2.0
  const strength = 0.62 * strengthJitter;
  return 1 - Math.pow(vNorm, curveJitter) * strength;
}

// 확대→축소는 CSS @keyframes 애니메이션(introZoom)이 담당한다. intro 클래스가 붙어있는
// 동안 애니메이션이 재생되고, 재생이 끝난 뒤(1.4초) 클래스를 떼면서 마무리한다.
// 모바일/태블릿(터치 기기)은 200개 개체를 그리는 것만으로도 부담이 커서, 확대 연출(가장 무거운
// 부분)은 생략하고 바로 제자리 크기로 보여준다 — 최종 모습(정지 상태)은 동일하다.
const isLikelyMobile =
  (('ontouchstart' in window) || navigator.maxTouchPoints > 0) &&
  Math.min(window.innerWidth, window.innerHeight) <= 1366;
if (!isLikelyMobile) {
  scene.classList.add('intro');
}
let introSpeed = true;
// 인트로 동안에는 깊이에 따른 채도/명도 조절을 끄고 원색 그대로 보여준다.
let introActive = true;

// 인트로(확대→축소) 동안에는 상단 톤 버튼과 겹치지 않도록 숨겨뒀다가,
// 인트로가 끝나는 시점에 자연스럽게 나타나게 한다.
setTimeout(() => {
  scene.classList.remove('intro');
  introSpeed = false;
  introActive = false;
  braking = true;
  if (toneButtonsEl) toneButtonsEl.style.opacity = '1';
  if (tutorialButtonEl) setHomeIconsOpacity('1');
}, 1500);

const stage = document.getElementById('stage');

const colors = [
  // ===== 봄 웜톤 (Spring Warm) =====
  '#FFB6A3', '#FF9F7A', '#FFCC70', '#FFE066', '#FFD93D',
  '#C6E86A', '#8FD694', '#5FD3BC', '#6EC6CA', '#F6A6C1',
  '#FF8FA3', '#FFA57D', '#F4C95D', '#B4E197', '#FFCF9C',
  '#FF7F50', '#FFB84D', '#E8E288', '#7ED6A5', '#FF9AA2',
  '#FFC93C', '#FF6F61', '#F9DC5C', '#8ED1B0', '#FFAE8A',

  // ===== 여름 쿨톤 (Summer Cool) =====
  '#D8C9E8', '#C3B1D9', '#AEC6E8', '#9FB8D9', '#B5D6D6',
  '#F0B8C8', '#E3A6C0', '#C7B8DB', '#A9C4D6', '#CBDDE8',
  '#DDBFD8', '#B9AFD9', '#9ECAD6', '#E6C2D0', '#C0C9E0',
  '#A8B9D6', '#D4B8C8', '#B0CFCF', '#C9B8DE', '#9BB8CC',
  '#E0C3D3', '#AABBD1', '#C6D3E0', '#B7A9CC', '#D3B8C4',

  // ===== 가을 웜톤 (Autumn Warm) =====
  '#B5651D', '#8B5E34', '#6E4B2A', '#A97142', '#C68642',
  '#7C6A46', '#9C7A3C', '#5C4A2E', '#D2A24C', '#B08D57',
  '#8A5A44', '#6B4226', '#A6763E', '#7A6240', '#4E3B26',
  '#C97C5D', '#9C5A3C', '#7A6F55', '#BC6C25', '#DDA15E',
  '#606C38', '#3E5641', '#734F30', '#8C6239', '#D08C4B',

  // ===== 겨울 쿨톤 (Winter Cool) =====
  '#0A0A0A', '#FFFFFF', '#E60039', '#001489', '#7B2D8E',
  '#0057B8', '#C8102E', '#1E3A5F', '#8E0038', '#2E0854',
  '#003049', '#5A189A', '#A4133C', '#03045E', '#240046',
  '#D90429', '#000814', '#3A0CA3', '#560BAD', '#F72585',
  '#001233', '#7209B7', '#4361EE', '#B5179E', '#212529',
];

const count = colors.length;

// 모든 개체를 씨글래스/자갈처럼 하나하나 다른 유기적인 돌멩이 모양으로 그린다.
// 데스크톱에서는 화면이 넓은 만큼 개체 크기를 조금 키운다.
const SHAPE_BASE_SIZE = isPortraitViewport ? 60 : 72;

function seeded(i) {
  const x = Math.sin(i * 12.9898) * 43758.5453
          + Math.sin(i * 78.233)  * 12345.6789;
  return x - Math.floor(x);
}

// 모빌 전체 크기(반지름/높이 퍼짐)를 줄이는 배율.
// 화면 비율(horizontalSpreadFactor/verticalSpreadFactor)에 맞춰 가로/세로 퍼짐만 재분배한다.
const MOBILE_SCALE = 1.15;
let { BASE_RADIUS, RADIUS_VARIANCE, HEIGHT_RANGE } = computeGeometryConstants({
  horizontalSpreadFactor,
  verticalSpreadFactor,
});

// 8개의 서로 다른 코너 반경(border-radius)을 섞어 완벽하지 않은 돌멩이 윤곽을 만든다.
// 하한을 높게 잡아(45%) 뾰족하게 각진 모서리가 생기지 않도록 한다.
function pebbleBorderRadius(seedBase) {
  const pick = (offset) => Math.round(45 + seeded(seedBase + offset) * 25); // 45~70%
  return `${pick(1)}% ${pick(2)}% ${pick(3)}% ${pick(4)}% / ${pick(5)}% ${pick(6)}% ${pick(7)}% ${pick(8)}%`;
}

function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRGB(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function createCard(color, w, h, borderRadius, hoverTwistDeg) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.color = color;
  card.style.width = w + 'px';
  card.style.height = h + 'px';
  card.style.top = (-h / 2) + 'px';
  card.style.left = (-w / 2) + 'px';
  card.style.borderRadius = borderRadius;
  card.style.setProperty('--hover-twist', `${hoverTwistDeg}deg`);

  // 내부 0~60%는 60% 불투명도로 평평하게 유지하다가, 60%~외부(100%)에서 0%(완전 투명)까지 서서히 빠진다.
  const faceStyle =
    `background: radial-gradient(circle, ${hexToRgba(color, 0.6)} 0%, ${hexToRgba(color, 0.6)} 60%, ${hexToRgba(color, 0)} 100%);`;

  // 뒤에 같은 모양·같은 색으로 거리 0인 그림자(글로우)를 깔아 은은하게 번지게 한다.
  // (깊이에 따른 opacity/blur가 이미 뒤쪽 개체는 흐리게 만들어주므로, 화면 앞쪽 개체일수록 더 진하게 보인다.)
  // box-shadow 블러는 비용이 커서, 200개가 계속 움직이는 모바일/태블릿에서는 반경을 크게 줄인다.
  const glowSize = Math.max(w, h) * (isLikelyMobile ? 0.22 : 0.7);
  card.style.boxShadow = `0 0 ${glowSize.toFixed(1)}px ${hexToRgba(color, 0.8)}`;

  card.innerHTML = `
    <div class="card-front" style="${faceStyle}"></div>
    <div class="card-back" style="${faceStyle}"></div>
    <div class="card-side-top" style="background:${color}"></div>
    <div class="card-side-bottom" style="background:${color}"></div>
    <div class="card-side-left" style="background:${color}"></div>
    <div class="card-side-right" style="background:${color}"></div>
  `;
  return card;
}

// 개체를 하나씩 stage에 바로 붙이면 200개만큼 레이아웃/리플로우가 반복돼 저사양 기기(특히
// 모바일)에서 초기 로딩이 무거워진다. DocumentFragment에 모아뒀다가 한 번에 붙인다.
const objectsFragment = document.createDocumentFragment();
// applyLayout()이 매 프레임(최대 60fps) 실행되는데, 그때마다 stage.querySelectorAll('.pivot')로
// 200개를 DOM에서 다시 찾고 pivot마다 querySelector('.card')까지 또 하면 초당 수천 번의
// DOM 탐색이 반복돼 저사양 기기에서 렉의 큰 원인이 된다. 카드 목록은 생성된 뒤 바뀌지
// 않으므로, 여기 한 번만 캐싱해두고 매 프레임은 이 배열만 순회한다.
const pivotCardPairs = [];

function addObject(baseAngle, radius, yOffset, card, section, seedBase) {
  const pivot = document.createElement('div');
  pivot.className = 'pivot';
  pivot.dataset.baseAngle = baseAngle;
  pivot.dataset.radius = radius;
  pivot.dataset.section = section;
  pivot.dataset.seedBase = seedBase;

  const arm = document.createElement('div');
  arm.className = 'arm';
  arm.style.transform = `translateZ(${radius}px) translateY(${yOffset}px)`;

  arm.appendChild(card);
  pivot.appendChild(arm);
  objectsFragment.appendChild(pivot);
  pivotCardPairs.push({ pivot, card });
}

// 화면 크기가 바뀔 때마다(리사이즈/회전) 개체들의 반지름·높이 퍼짐을 현재 화면 비율에 맞게
// 다시 계산해서 위치만 부드럽게 재배치한다(모양·크기는 그대로).
function updateObjectPositions() {
  const spread = computeSpreadFactors();
  horizontalSpreadFactor = spread.horizontalSpreadFactor;
  verticalSpreadFactor = spread.verticalSpreadFactor;
  ({ BASE_RADIUS, RADIUS_VARIANCE, HEIGHT_RANGE } = computeGeometryConstants(spread));

  const yLimits = computeVerticalYOffsetLimits();

  stage.querySelectorAll('.pivot').forEach((pivot) => {
    const seedBase = parseFloat(pivot.dataset.seedBase);
    const radiusSeed = seeded(seedBase + 53);
    const radius = BASE_RADIUS + (radiusSeed - 0.5) * RADIUS_VARIANCE;

    const isOuterLayer = radiusSeed > 0.66;
    const isMobileLayout = window.innerWidth < window.innerHeight;
    // 처음처럼 위아래로 넉넉하게 퍼지게 하되, 마름모 실루엣은 반지름 taper(rhombusTaper)가 만든다.
    const heightScale = isOuterLayer ? 0.35 : 1;
    const rawYOffset =
      ((seeded(seedBase) - 0.5) * HEIGHT_RANGE +
       (seeded(seedBase + 137) - 0.5) * (HEIGHT_RANGE * 0.4)) * heightScale;
    const yOffset = clampYOffset(rawYOffset, yLimits);
    const finalRadius = isMobileLayout ? radius * rhombusTaper(yOffset, yLimits, seedBase) : radius;

    pivot.dataset.radius = finalRadius;
    const arm = pivot.querySelector('.arm');
    if (arm) arm.style.transform = `translateZ(${finalRadius}px) translateY(${yOffset}px)`;
  });
}

// 리사이즈 중 과도한 연산을 피하면서도 실시간으로 여백/배치가 계속 따라오도록 rAF로 묶는다.
let responsiveUpdateRAF = null;
function scheduleResponsiveUpdate() {
  if (responsiveUpdateRAF) return;
  responsiveUpdateRAF = requestAnimationFrame(() => {
    responsiveUpdateRAF = null;
    updateResponsiveScale();
    updateObjectPositions();
  });
}
window.addEventListener('resize', scheduleResponsiveUpdate);

// 색상 하나당 OBJECTS_PER_COLOR개의 개체를 만들고, 모양은 SHAPES 풀에서 골고루 순환시킨다.
const OBJECTS_PER_COLOR = 2;
const initialYLimits = computeVerticalYOffsetLimits();

for (let i = 0; i < count; i++) {
  for (let k = 0; k < OBJECTS_PER_COLOR; k++) {
    const seedBase = i * 31 + k * 977;
    const baseAngle = (360 / count) * i + (seeded(seedBase + 3) - 0.5) * (360 / count) * 1.6;
    const radiusSeed = seeded(seedBase + 53);
    const radius = BASE_RADIUS + (radiusSeed - 0.5) * RADIUS_VARIANCE;

    // 반지름이 가장 큰(가장 겉의) 개체들은 높낮이 퍼짐을 줄이고 크기도 작게.
    const isOuterLayer = radiusSeed > 0.66;
    const isMobileLayout = window.innerWidth < window.innerHeight;
    // 처음처럼 위아래로 넉넉하게 퍼지게 하되, 마름모 실루엣은 반지름 taper(rhombusTaper)가 만든다.
    const heightScale = isOuterLayer ? 0.35 : 1;
    const rawYOffset =
      ((seeded(seedBase) - 0.5) * HEIGHT_RANGE +
       (seeded(seedBase + 137) - 0.5) * (HEIGHT_RANGE * 0.4)) * heightScale;
    const yOffset = clampYOffset(rawYOffset, initialYLimits);
    const finalRadius = isMobileLayout ? radius * rhombusTaper(yOffset, initialYLimits, seedBase) : radius;

    const sizeJitter = 0.55 + seeded(seedBase + 71) * 1.0; // 0.55~1.55(평균은 이전과 동일): 편차 폭만 넓힘
    const outerSizeScale = isOuterLayer ? 0.65 : 1;
    const size = SHAPE_BASE_SIZE * sizeJitter * outerSizeScale;

    // 완벽한 원이 아니라 조금씩 길쭉하거나 눌린 자갈 비율로.
    const aspect = 0.75 + seeded(seedBase + 91) * 0.5; // 0.75~1.25
    const w = size * Math.sqrt(aspect);
    const h = size / Math.sqrt(aspect);
    const borderRadius = pebbleBorderRadius(seedBase + 300);

    // 마우스를 올렸을 때 틀어지는 방향(좌/우)을 개체마다 다르게.
    const hoverTwistDeg = (seeded(seedBase + 211) < 0.5 ? -1 : 1) * (16 + seeded(seedBase + 233) * 10);

    const card = createCard(colors[i], w, h, borderRadius, hoverTwistDeg);
    const section = Math.floor(i / (count / 4));
    addObject(baseAngle, finalRadius, yOffset, card, section, seedBase);
  }
}
stage.appendChild(objectsFragment); // 모아둔 개체를 한 번에 붙여서 리플로우를 한 번으로 줄인다.

function hexToHSL(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hh = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: hh = ((g - b) / d) % 6; break;
      case g: hh = (b - r) / d + 2; break;
      case b: hh = (r - g) / d + 4; break;
    }
    hh *= 60;
    if (hh < 0) hh += 360;
  }
  return { h: hh, s: s * 100, l: l * 100 };
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// 클릭한 색이 속한 톤 계열(봄/여름/가을/겨울)의 실제 팔레트 색상들을 그대로 반환한다.
function familyPaletteFor(hex) {
  const idx = colors.findIndex((c) => c.toLowerCase() === hex.toLowerCase());
  if (idx === -1) return [hex];
  const segment = count / 4;
  const section = Math.floor(idx / segment);
  return colors.slice(section * segment, (section + 1) * segment);
}

// 봄·가을은 웜톤, 여름·겨울은 쿨톤 계열이라 두 계절씩 묶어 큰 톤 단위 팔레트를 만든다.
const FAMILY_SEGMENT = count / 4;
const WARM_COLORS = [
  ...colors.slice(0, FAMILY_SEGMENT),
  ...colors.slice(FAMILY_SEGMENT * 2, FAMILY_SEGMENT * 3),
];
const COOL_COLORS = [
  ...colors.slice(FAMILY_SEGMENT, FAMILY_SEGMENT * 2),
  ...colors.slice(FAMILY_SEGMENT * 3, FAMILY_SEGMENT * 4),
];
const ALL_COLORS = colors;

// 명도(Value) 단계: 전체 100색을 밝기(HSL lightness) 순으로 정렬해 4단계로 나눈다
// (어두운 쪽부터 Deepest → Deep → Light → Lightest).
const VALUE_LEVEL_LABELS = ['Deepest', 'Deep', 'Light', 'Lightest'];
const VALUE_LEVELS = (() => {
  const sorted = [...ALL_COLORS].sort((a, b) => hexToHSL(a).l - hexToHSL(b).l);
  const levelSize = Math.ceil(sorted.length / VALUE_LEVEL_LABELS.length);
  return VALUE_LEVEL_LABELS.map((_, i) => sorted.slice(i * levelSize, (i + 1) * levelSize));
})();

// 채도·대비(Chroma) 단계: 전체 100색을 채도(HSL saturation) 순으로 정렬해 3단계로 나눈다
// (탁한 쪽부터 Grayish → Muted → High Chroma).
const CHROMA_LEVEL_LABELS = ['Grayish', 'Muted', 'High Chroma'];
const CHROMA_LEVELS = (() => {
  const sorted = [...ALL_COLORS].sort((a, b) => hexToHSL(a).s - hexToHSL(b).s);
  const levelSize = Math.ceil(sorted.length / CHROMA_LEVEL_LABELS.length);
  return CHROMA_LEVEL_LABELS.map((_, i) => sorted.slice(i * levelSize, (i + 1) * levelSize));
})();

function darkenHex(hex, factor) {
  const h = hex.replace('#', '');
  const clamp = (v) => Math.min(255, Math.max(0, v));
  const r = clamp(Math.round(parseInt(h.slice(0, 2), 16) * factor));
  const g = clamp(Math.round(parseInt(h.slice(2, 4), 16) * factor));
  const b = clamp(Math.round(parseInt(h.slice(4, 6), 16) * factor));
  const toHex = (v) => v.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function lightenHex(hex, factor) {
  const h = hex.replace('#', '');
  const clamp = (v) => Math.min(255, Math.max(0, v));
  const r = clamp(Math.round(parseInt(h.slice(0, 2), 16) * factor));
  const g = clamp(Math.round(parseInt(h.slice(2, 4), 16) * factor));
  const b = clamp(Math.round(parseInt(h.slice(4, 6), 16) * factor));
  const toHex = (v) => v.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRGB(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

let rotationOffset = 0;
let isDragging = false;
let startX = 0;
let startRotation = 0;
let autoRotate = true;
let dragDistance = 0;

const colorOverlay = document.createElement('div');
colorOverlay.style.position = 'fixed';
colorOverlay.style.inset = '0';
colorOverlay.style.zIndex = '999';
colorOverlay.style.pointerEvents = 'none';
colorOverlay.style.transitionProperty = 'clip-path';
colorOverlay.style.transitionDuration = '0.7s';
colorOverlay.style.transitionTimingFunction = 'cubic-bezier(0.4, 0, 0.2, 1)';
colorOverlay.style.clipPath = 'circle(0px at 50% 50%)';
document.body.appendChild(colorOverlay);

colorOverlay.style.background = '#ffffff';

const curlCanvas = document.createElement('canvas');
curlCanvas.style.position = 'absolute';
curlCanvas.style.inset = '0';
curlCanvas.style.width = '100%';
curlCanvas.style.height = '100%';
colorOverlay.appendChild(curlCanvas);
const curlCtx = curlCanvas.getContext('2d');

function resizeCurlCanvas() {
  const dpr = window.devicePixelRatio || 1;
  curlCanvas.width = window.innerWidth * dpr;
  curlCanvas.height = window.innerHeight * dpr;
  curlCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resizeCurlCanvas();
window.addEventListener('resize', resizeCurlCanvas);

let currentColor = '#ffffff';
let currentPalette = [];
let currentPaletteIndex = 0;
// 'family'(클릭한 색의 계절 팔레트) | 'warm' | 'cool' | 'all' | 'confirmed'
let currentPaletteMode = 'family';
// 튜토리얼을 끝내고 들어온 실전 모드일 때만 true. 카드를 직접 클릭한 평소 흐름에서는 false로 유지된다.
let isPracticeMode = false;
// "확정한 색" 화면(팔레트 아이콘)으로 들어가기 직전의 모드/색. 뒤로가기를 누르면
// 화면 전체를 나가는 대신 이 상태로 되돌아간다.
let previousPaletteMode = null;
let previousPaletteColor = null;

// 튜토리얼 아이콘(문서 모양)은 첫 화면(메인 모빌)에서만 보이고, 색을 클릭해 들어간
// 화면(실전 모드 포함)에서는 숨긴다. 실전 모드에서는 대신 팔레트(확정 색 목록) 아이콘이 그 자리를 대신한다.
const tutorialButtonEl = document.getElementById('tutorialButton');
// 모바일에서는 작은 아이콘 대신 "튜토리얼" 텍스트 버튼으로 대체한다(터치로는
// 아이콘보다 글자가 있는 쪽이 무엇을 누르는 건지 더 분명하다).
if (isLikelyMobile) {
  tutorialButtonEl.textContent = 'Tutorial';
  // 아이콘(작은 정사각형)에서 텍스트(더 넓은 버튼)로 바뀌면 버튼의 실제 세로
  // 위치/크기가 달라지므로, 모빌 세로 중앙 정렬을 다시 계산한다.
  updateResponsiveScale();
}

// 홈 화면 우측 상단, 튜토리얼 아이콘 바로 밑의 "결제하기" 버튼. 봉투를 눌렀을 때와
// 완전히 같은 결제 화면(showPaymentScreen, 아래에서 정의됨 — 함수 선언이라 호이스팅됨)을
// 그대로 띄운다. 튜토리얼 아이콘과 항상 같이 나타나고 같이 숨어야 하므로, 둘의
// opacity/pointerEvents를 한 번에 맞춰주는 setHomeIconsOpacity를 통해서만 제어한다.
const homePaymentButton = document.createElement('button');
homePaymentButton.type = 'button';
homePaymentButton.className = 'home-payment-button';
homePaymentButton.textContent = '결제하기';
homePaymentButton.setAttribute('aria-label', '퍼스널 RGB 결과지 결제하기');
homePaymentButton.style.opacity = '0';
homePaymentButton.style.pointerEvents = 'none';
homePaymentButton.addEventListener('click', (e) => {
  e.stopPropagation();
  paymentOpenedFromHome = true;
  pendingFinalSeason = 0; // 미리보기: 봄 페일
  showPaymentScreen();
});
document.body.appendChild(homePaymentButton);

function setHomeIconsOpacity(value) {
  tutorialButtonEl.style.opacity = value;
  tutorialButtonEl.style.pointerEvents = value === '1' ? 'auto' : 'none';
  homePaymentButton.style.opacity = value;
  homePaymentButton.style.pointerEvents = value === '1' ? 'auto' : 'none';
}

// 홈 화면 좌측 하단 "사업자 정보" 토글. 누르면 펼쳐지고 다시 누르면 접힌다.
const siteFooterEl = document.getElementById('siteFooter');
const siteFooterToggle = document.getElementById('siteFooterToggle');
const siteFooterDetails = document.getElementById('siteFooterDetails');
if (siteFooterToggle && siteFooterDetails) {
  siteFooterToggle.addEventListener('click', () => {
    siteFooterDetails.classList.toggle('expanded');
  });
}

// updateBg()가 매 프레임 body 배경색을 바꾸므로, 그 배경의 밝기를 계산해
// 어두우면 흰색, 밝으면 검정색 글씨가 되도록 실시간으로 맞춘다.
function updateSiteFooterContrast(bgColor) {
  if (!siteFooterEl) return;
  const m = bgColor.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
  if (!m) return;
  const r = parseFloat(m[1]);
  const g = parseFloat(m[2]);
  const b = parseFloat(m[3]);
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  siteFooterEl.style.color = luminance < 128 ? '#ffffff' : '#111111';
}

// 실전 모드에서 체크 표시로 "확정"한 색들의 목록. 세션 동안 계속 쌓인다.
const confirmedColors = [];

const backButton = document.createElement('button');
backButton.className = 'back-button';
backButton.textContent = '← Back';
backButton.style.position = 'fixed';
backButton.style.top = 'calc(28px + env(safe-area-inset-top))';
backButton.style.left = 'calc(28px + env(safe-area-inset-left))';
backButton.style.zIndex = '1001';
backButton.style.background = 'transparent';
backButton.style.border = 'none';
backButton.style.color = '#111111';
backButton.style.padding = '8px 16px';
backButton.style.borderRadius = '999px';
backButton.style.fontSize = '12px';
backButton.style.fontWeight = '300';
backButton.style.cursor = 'pointer';
backButton.style.opacity = '0';
backButton.style.pointerEvents = 'none';
backButton.style.transition = 'opacity 0.4s ease';
document.body.appendChild(backButton);

// 카메라 앱의 모드 선택 바처럼, 가운데는 선명하고 좌우로 갈수록 좁아지며 흐려지는
// 원통형(코브플로우) 휠로 색을 고른다.
const paletteBar = document.createElement('div');
paletteBar.style.position = 'fixed';
paletteBar.style.bottom = '44px';
paletteBar.style.left = '50%';
paletteBar.style.transform = 'translateX(-50%)';
paletteBar.style.zIndex = '1001';
// 모바일은 5개, 데스크톱/태블릿은 10개 정도가 중앙에 선명하게 보이도록 폭을 다르게 둔다.
paletteBar.style.width = isLikelyMobile ? '240px' : '460px';
// mask-image는 overflow:visible이어도 엘리먼트 박스 높이 안으로 렌더링을 가둔다.
// 그림자가 잘리지 않도록 스와치(40px)보다 넉넉하게 높이를 준다.
paletteBar.style.height = '72px';
paletteBar.style.overflow = 'visible';
// 좌우 끝은 그라데이션으로 자연스럽게 사라지도록 마스킹한다.
paletteBar.style.maskImage = 'linear-gradient(to right, transparent 0%, black 30%, black 70%, transparent 100%)';
paletteBar.style.webkitMaskImage = paletteBar.style.maskImage;
paletteBar.style.opacity = '0';
paletteBar.style.pointerEvents = 'none';
paletteBar.style.transition = 'opacity 0.4s ease';
// 좌우 스와이프 제스처를 브라우저 기본 스크롤/줌 없이 온전히 우리가 처리한다.
paletteBar.style.touchAction = 'none';
document.body.appendChild(paletteBar);

// 모바일/태블릿에서는 팔레트 바를 좌우로 스와이프해도 색이 바뀐다. 손가락을 따라
// 스와치들이 1:1로 같이 움직이다가, 한 칸(PALETTE_SLOT_WIDTH)을 다 넘어서는 순간마다
// 실제 색이 한 단계씩 드르륵 넘어가는 방식(픽커 휠과 비슷하다).
let paletteDragActive = false;
let paletteDragStartX = 0;
let paletteDragOffsetX = 0;

function setPaletteSwatchTransitionsEnabled(enabled) {
  paletteSwatchEls.forEach((el) => {
    el.style.transition = enabled ? PALETTE_SWATCH_TRANSITION : 'none';
  });
}

function paletteBarDragStart(clientX) {
  if (!isPracticeMode || isPaletteGridOpen || currentPalette.length === 0) return;
  paletteDragActive = true;
  paletteDragStartX = clientX;
  paletteDragOffsetX = 0;
  setPaletteSwatchTransitionsEnabled(false);
}

function paletteBarDragMove(clientX) {
  if (!paletteDragActive) return;
  paletteDragOffsetX = clientX - paletteDragStartX;

  while (paletteDragOffsetX <= -PALETTE_SLOT_WIDTH) {
    currentPaletteIndex = (currentPaletteIndex + 1) % currentPalette.length;
    paletteDragOffsetX += PALETTE_SLOT_WIDTH;
    changeOverlayColor(currentPalette[currentPaletteIndex]);
  }
  while (paletteDragOffsetX >= PALETTE_SLOT_WIDTH) {
    currentPaletteIndex = (currentPaletteIndex - 1 + currentPalette.length) % currentPalette.length;
    paletteDragOffsetX -= PALETTE_SLOT_WIDTH;
    changeOverlayColor(currentPalette[currentPaletteIndex]);
  }

  applyPaletteLayout();
}

function paletteBarDragEnd() {
  if (!paletteDragActive) return;
  paletteDragActive = false;
  paletteDragOffsetX = 0;
  setPaletteSwatchTransitionsEnabled(true);
  applyPaletteLayout();
}

paletteBar.addEventListener('touchstart', (e) => {
  paletteBarDragStart(e.touches[0].clientX);
}, { passive: true });
window.addEventListener('touchmove', (e) => {
  if (!paletteDragActive) return;
  e.preventDefault();
  paletteBarDragMove(e.touches[0].clientX);
}, { passive: false });
window.addEventListener('touchend', paletteBarDragEnd);

// 데스크톱(마우스/노트북 트랙패드)에서도 팔레트 바를 좌우로 드래그하면 촤르륵
// 넘어가게 한다. 실제로 크게 드래그했다면, 마우스를 뗀 자리에 있던 스와치의
// "클릭(가운데로 당겨오기)" 동작이 같이 발동하지 않도록 그 클릭을 막는다.
let paletteMouseDown = false;
let paletteMouseStartX = 0;
let paletteMouseDidDrag = false;
paletteBar.addEventListener('mousedown', (e) => {
  paletteMouseDown = true;
  paletteMouseStartX = e.clientX;
  paletteMouseDidDrag = false;
  paletteBarDragStart(e.clientX);
});
window.addEventListener('mousemove', (e) => {
  if (!paletteMouseDown) return;
  if (Math.abs(e.clientX - paletteMouseStartX) > CLICK_DRAG_THRESHOLD) paletteMouseDidDrag = true;
  paletteBarDragMove(e.clientX);
});
window.addEventListener('mouseup', () => {
  if (!paletteMouseDown) return;
  paletteMouseDown = false;
  paletteBarDragEnd();
});
paletteBar.addEventListener('click', (e) => {
  if (paletteMouseDidDrag) e.stopPropagation();
}, true);

// 노트북 트랙패드 두 손가락 좌우 스와이프는 마우스 드래그가 아니라 wheel
// 이벤트(가로 스크롤, deltaX)로 들어온다. 그 가로 스크롤량을 가상의 드래그
// 위치로 누적해서 기존 paletteBarDragMove에 그대로 흘려보낸다 — 별도 로직을
// 새로 만들지 않고 터치/마우스 드래그와 완전히 같은 방식으로 동작한다.
let paletteWheelActive = false;
let paletteWheelVirtualX = 0;
let paletteWheelIdleTimer = null;
paletteBar.addEventListener('wheel', (e) => {
  if (!isPracticeMode || isPaletteGridOpen || currentPalette.length === 0) return;
  // 세로 휠(카드 회전용)과 헷갈리지 않도록, 가로 스크롤이 더 클 때만 반응한다.
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
  e.preventDefault();
  if (!paletteWheelActive) {
    paletteWheelActive = true;
    paletteWheelVirtualX = 0;
    paletteBarDragStart(0);
  }
  paletteWheelVirtualX -= e.deltaX;
  paletteBarDragMove(paletteWheelVirtualX);
  clearTimeout(paletteWheelIdleTimer);
  paletteWheelIdleTimer = setTimeout(() => {
    paletteWheelActive = false;
    paletteBarDragEnd();
  }, 150);
}, { passive: false });

// 중앙 스와치 뒤에 깔리는 그림자. box-shadow는 블렌드 모드를 따로 줄 수 없어서 별도
// 엘리먼트로 만들고 mix-blend-mode: multiply로 배경과 곱해지게 한다.
// paletteBar는 자체 z-index(1001)로 스태킹 컨텍스트를 만들어서, 그 "안"에 넣으면
// 먼저 그려진 게 아무것도 없어 곱할 대상이 없어져 안 보이게 된다. 그래서 paletteBar
// 바깥(body 바로 아래, z-index만 한 단계 낮게)에 형제로 두고 같은 좌표에 겹쳐놓는다.
// 코브플로우일 때는 선택된 스와치가 항상 화면 중앙(오프셋 0)에 오지만, 그리드로
// 펼쳐지면 선택된 스와치가 그리드 안 자기 칸 위치로 옮겨간다. 그림자가 그 자리를
// 계속 따라가도록 기준 위치(중앙)에 오프셋만 transform으로 더해서 이동시킨다.
const paletteCenterShadow = document.createElement('div');
paletteCenterShadow.style.position = 'fixed';
// paletteBar(bottom:32px, height:72px)의 스와치 중심은 화면 하단에서 68px 지점.
// 그보다 6px 아래로 살짝 내려서 그림자처럼 보이게(76px 높이의 절반=38px를 뺀 값).
paletteCenterShadow.style.bottom = '36px';
paletteCenterShadow.style.left = '50%';
paletteCenterShadow.style.width = '76px';
paletteCenterShadow.style.height = '76px';
paletteCenterShadow.style.borderRadius = '50%';
paletteCenterShadow.style.transform = 'translate(-50%, 0)';
paletteCenterShadow.style.background = 'rgba(0, 0, 0, 0.6)';
paletteCenterShadow.style.filter = 'blur(24px)';
paletteCenterShadow.style.mixBlendMode = 'multiply';
paletteCenterShadow.style.pointerEvents = 'none';
paletteCenterShadow.style.zIndex = '1000';
paletteCenterShadow.style.opacity = '0';
paletteCenterShadow.style.transition = 'opacity 0.4s ease, transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)';
document.body.appendChild(paletteCenterShadow);

let lastClickPoint = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

// 스와치 사이 간격(px, 항상 동일)과, 크기/흐림/투명도 변화에 쓰는 각도(도).
// 각도 간격이 좁을수록 더 많은 스와치가 90도(사라지는 지점) 안쪽에 들어와 선명하게 보인다.
// 모바일: 5개(±2) / 데스크톱·태블릿: 10개(±4~5) 정도가 선명하게 보이도록 값을 다르게 둔다.
const PALETTE_SLOT_WIDTH = 46;
const PALETTE_ANGLE_STEP = isLikelyMobile ? 16 : 9;
const PALETTE_SWATCH_TRANSITION =
  'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1), filter 0.55s ease, opacity 0.55s ease, box-shadow 0.3s ease';

// 재렌더링할 때마다 DOM을 통째로 새로 만들면(innerHTML='') 트랜지션이 걸릴 "이전 상태"가
// 없어서 스르륵 움직이는 모션이 재생되지 않는다. 같은 팔레트일 때는 기존 스와치 엘리먼트를
// 재사용하고 위치/크기만 갱신해야 부드럽게 슬라이드된다.
let paletteSwatchEls = [];
let paletteColorsKey = null;
let isPaletteGridOpen = false;

// 코브플로우(중앙 강조) 배치.
function positionSwatchCoverflow(swatch, idx) {
  // 좌우 간격은 항상 동일(px)하게 두고, 크기·흐림·투명도만 각도(cos)로 계산해서
  // 입체적으로 멀어지는 느낌을 준다.
  const dragOffsetIdx = paletteDragActive ? paletteDragOffsetX / PALETTE_SLOT_WIDTH : 0;
  const raw = idx - currentPaletteIndex + dragOffsetIdx;
  const x = raw * PALETTE_SLOT_WIDTH;
  const angleDeg = Math.max(-100, Math.min(100, raw * PALETTE_ANGLE_STEP));
  const angleRad = (angleDeg * Math.PI) / 180;
  const depth = Math.cos(angleRad); // 1(정중앙)~0(옆면)~음수(휠 뒤로 넘어감)
  const visible = depth > 0;
  const scale = Math.max(0.15, depth);
  const blur = visible ? (1 - depth) * 5 : 6;
  const opacity = visible ? Math.max(0, depth) : 0;

  swatch.style.transform = `translate(-50%, -50%) translateX(${x.toFixed(1)}px) scale(${scale.toFixed(3)})`;
  swatch.style.filter = `blur(${blur.toFixed(2)}px)`;
  swatch.style.opacity = opacity.toFixed(3);
  swatch.style.zIndex = String(Math.round(depth * 100));
  swatch.style.pointerEvents = opacity > 0.15 ? 'auto' : 'none';
}

// 펼침 배치: 새 배경을 따로 만들지 않고, 코브플로우에 쓰던 같은 스와치 엘리먼트를
// 같은 바(paletteBar) 위에서 그리드로 늘어놓는다. 맨 아래 줄이 코브플로우가 있던
// 자리(오프셋 0)에 오고, 위 줄일수록 위로 쌓이는 방식이라 "펼쳐지는" 느낌을 준다.
const PALETTE_GRID_SLOT = 50;
// 모바일은 항상 정확히 5줄, 데스크톱·태블릿은 항상 정확히 2줄로만 펼친다.
const PALETTE_GRID_MOBILE_ROWS = 5;
const PALETTE_GRID_ROWS = 2;

function computePaletteGridDims() {
  const total = currentPalette.length;
  const rows = isLikelyMobile ? PALETTE_GRID_MOBILE_ROWS : PALETTE_GRID_ROWS;
  return { cols: Math.ceil(total / rows), rows };
}

// 모바일에서 색이 많아 열(cols)이 늘어나면 고정 간격(50px)로는 그리드가 화면
// 폭을 넘어가 양옆 여백 없이 잘려버린다. 화면 폭에 맞춰 열 간격을 좁히고(최대
// 기존 50px), 그만큼 스와치도 같이 살짝 줄여서 겹치지 않게 하고 항상 여백이
// 남게 한다.
const PALETTE_GRID_SIDE_MARGIN = 24;

function paletteGridColSlot(cols) {
  if (!isLikelyMobile) return PALETTE_GRID_SLOT;
  const available = window.innerWidth - PALETTE_GRID_SIDE_MARGIN * 2;
  return Math.min(PALETTE_GRID_SLOT, available / cols);
}

function positionSwatchGrid(swatch, idx) {
  const { cols, rows } = computePaletteGridDims();
  const colSlot = paletteGridColSlot(cols);
  const scale = Math.min(1, colSlot / PALETTE_GRID_SLOT);
  const col = idx % cols;
  const rowFromTop = Math.floor(idx / cols);
  const x = (col - (cols - 1) / 2) * colSlot;
  const y = (rowFromTop - (rows - 1)) * PALETTE_GRID_SLOT;

  swatch.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(3)})`;
  swatch.style.filter = 'blur(0px)';
  swatch.style.opacity = '1';
  swatch.style.zIndex = '10';
  swatch.style.pointerEvents = 'auto';
}

// 코브플로우에서는 선택된 스와치가 항상 오프셋 0(정중앙)에 있지만, 그리드에서는
// 자기 칸(col/row) 위치로 이동해 있으므로 그림자를 그 위치로 옮기기 위해 재사용한다.
function getSelectedSwatchOffset() {
  if (!isPaletteGridOpen) return { x: 0, y: 0 };
  const { cols, rows } = computePaletteGridDims();
  const colSlot = paletteGridColSlot(cols);
  const col = currentPaletteIndex % cols;
  const rowFromTop = Math.floor(currentPaletteIndex / cols);
  const x = (col - (cols - 1) / 2) * colSlot;
  const y = (rowFromTop - (rows - 1)) * PALETTE_GRID_SLOT;
  return { x, y };
}

function updatePaletteShadowPosition() {
  const { x, y } = getSelectedSwatchOffset();
  paletteCenterShadow.style.transform = `translate(calc(-50% + ${x.toFixed(1)}px), ${y.toFixed(1)}px)`;
}

function applyPaletteLayout() {
  paletteSwatchEls.forEach((swatch, idx) => {
    if (isPaletteGridOpen) positionSwatchGrid(swatch, idx);
    else positionSwatchCoverflow(swatch, idx);
  });
  updatePaletteShadowPosition();
}

// 계절(family) 팔레트든 톤(warm/cool/all) 팔레트든 같은 방식으로 스와치를 만들고 배치한다.
function renderPaletteFromList(palette, baseColor) {
  const key = palette.join(',');

  if (key !== paletteColorsKey) {
    // 완전히 다른 팔레트일 때만 스와치를 새로 만든다.
    paletteColorsKey = key;
    currentPalette = palette;
    paletteBar.innerHTML = '';
    paletteSwatchEls = currentPalette.map((swatchColor, idx) => {
      const swatch = document.createElement('button');
      swatch.style.position = 'absolute';
      swatch.style.top = '50%';
      swatch.style.left = '50%';
      swatch.style.width = '40px';
      swatch.style.height = '40px';
      swatch.style.borderRadius = pebbleBorderRadius(idx * 137 + 5000);
      swatch.style.border = 'none';
      swatch.style.padding = '0';
      // 버튼 기본 배경(브라우저별 회색/흰색)이 구멍 사이로 비치지 않도록 완전히 투명하게 둔다.
      // 실제 뚫려 보여야 할 색은 안쪽 hole 레이어가 맡는다.
      swatch.style.background = 'transparent';
      swatch.style.cursor = 'pointer';
      swatch.style.transition = PALETTE_SWATCH_TRANSITION;
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        // 이미 중앙에 와 있는(선명해진) 스와치를 한 번 더 선택하면 "확정"으로 취급하고,
        // 아니면 평소처럼 그 색을 중앙으로 가져온다.
        if (isPracticeMode && idx === currentPaletteIndex) {
          confirmSwatchColor(swatchColor, swatch);
          return;
        }
        currentPaletteIndex = idx;
        changeOverlayColor(swatchColor);
      });

      // 실제 색과 체크(또는 확정 시 원형) 구멍을 담는 아래쪽 레이어.
      // mask는 이 레이어에만 걸어서, 위에 얹는 "마개"가 그 마스크의 영향을 받지 않게 한다
      // (같은 엘리먼트에 걸면 자식까지 뚫려버려 마개로 가릴 수 없기 때문).
      const hole = document.createElement('div');
      hole.style.position = 'absolute';
      hole.style.inset = '0';
      hole.style.borderRadius = 'inherit';
      hole.style.background = swatchColor;
      // 마스크로 뚫린 부분은 뒤쪽(화면 색)이 비치되, 뿌옇게 흐려 보이도록 반투명
      // 유리처럼 처리한다. 뒤쪽 색이 스와치 색과 거의 같아 구멍이 안 보이는 경우가
      // 많아서, 살짝 어둡게(brightness) 눌러 색이 같아도 구멍이 티가 나게 한다.
      hole.style.backdropFilter = 'blur(7px) brightness(0.78)';
      hole.style.webkitBackdropFilter = 'blur(7px) brightness(0.78)';
      swatch.appendChild(hole);
      swatch.holeEl = hole;

      // 체크 구멍을 평소엔 같은 색으로 덮어 가려두는 "마개". 중앙으로 오면 이 마개가
      // 스르륵 사라지면서(opacity transition) 체크 표시가 자연스럽게 드러난다.
      const plug = document.createElement('div');
      plug.style.position = 'absolute';
      plug.style.inset = '0';
      plug.style.borderRadius = 'inherit';
      plug.style.background = swatchColor;
      plug.style.transition = 'opacity 0.35s ease';
      plug.style.pointerEvents = 'none';
      swatch.appendChild(plug);
      swatch.plugEl = plug;

      paletteBar.appendChild(swatch);
      return swatch;
    });
  }

  const matchIndex = currentPalette.findIndex((c) => c.toLowerCase() === baseColor.toLowerCase());
  currentPaletteIndex = matchIndex >= 0 ? matchIndex : 0;

  paletteSwatchEls.forEach((swatch, idx) => {
    const swatchColor = currentPalette[idx];
    updateSwatchCheckMask(swatch, swatchColor);
    updateSwatchCheckPlug(swatch, idx, swatchColor);
  });

  applyPaletteLayout();
}

// 톤(웜/쿨/전체) 모드에 맞는 색상 목록을 반환한다. family 모드는 클릭한 색의 계절 팔레트.
function paletteListForMode(mode, baseColor) {
  if (mode === 'warm') return WARM_COLORS;
  if (mode === 'cool') return COOL_COLORS;
  if (mode === 'all') return ALL_COLORS;
  if (mode === 'confirmed') return confirmedColors;
  // 확정한 색 화면 안에서 어떤 탭(웜/쿨/명도 단계)을 고르든, 전체 팔레트가 아니라
  // "확정한 색들 중" 그 탭에 해당하는 것만 걸러서 보여준다(확정 화면 밖으로 벗어나지 않는다).
  if (mode.startsWith('confirmed-')) {
    const subMode = mode.slice('confirmed-'.length);
    const subList = paletteListForMode(subMode, baseColor);
    return confirmedColors.filter((c) => subList.some((w) => w.toLowerCase() === c.toLowerCase()));
  }
  const valueLevelIndex = VALUE_LEVEL_LABELS.findIndex((_, i) => mode === `value${i}`);
  if (valueLevelIndex >= 0) return VALUE_LEVELS[valueLevelIndex];
  const chromaLevelIndex = CHROMA_LEVEL_LABELS.findIndex((_, i) => mode === `chroma${i}`);
  if (chromaLevelIndex >= 0) return CHROMA_LEVELS[chromaLevelIndex];
  return familyPaletteFor(baseColor);
}

function renderPalette(baseColor) {
  currentPaletteMode = 'family';
  renderPaletteFromList(familyPaletteFor(baseColor), baseColor);
  updateToneTabsActive();
}

// 현재 톤 모드를 기준으로 팔레트를 새로 그린다(색이 바뀌어도 웜/쿨/전체 모드는 유지).
function refreshPaletteForCurrentColor(baseColor) {
  if (currentPaletteMode === 'family') {
    renderPalette(baseColor);
  } else {
    renderPaletteFromList(paletteListForMode(currentPaletteMode, baseColor), baseColor);
  }
}

function setPaletteMode(mode) {
  currentPaletteMode = mode;
  const list = paletteListForMode(mode, currentColor);
  // 확정한 색을 웜/쿨로 걸렀을 때 한쪽이 비어 있을 수 있다 — 그럴 땐 배경색을 그대로 둔다.
  const baseColor = list.length === 0
    ? currentColor
    : (list.some((c) => c.toLowerCase() === currentColor.toLowerCase()) ? currentColor : list[0]);

  // 탭 전환도 스와치를 고른 것과 동일하게 취급해 전체 화면 배경을 새 팔레트의 기준색으로 맞춘다.
  currentColor = baseColor;
  colorOverlay.style.background = baseColor;
  updateBackButtonContrast(baseColor);
  updatePaletteShadowColor(baseColor);
  updateToneTabsContrast(baseColor);
  updatePaletteViewButtonContrast(baseColor);

  renderPaletteFromList(list, baseColor);
  updateToneTabsActive();
}

// 팔레트 바 위의 화살표: 누르면 새 배경을 만들지 않고 기존 팔레트 바(paletteBar)와
// 그 안의 스와치들을 그대로 그리드로 펼쳐서 톤 계열의 색 전체를 보여준다.
// 모양(끝이 둥근 넓적한 삼각형)과 아래로 갈수록 흐려지는 페이드를 하나의 SVG 마스크로 합쳐서 그린다.
const ARROW_MASK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 76 40">' +
  '<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0%" stop-color="#fff" stop-opacity="1"/>' +
  '<stop offset="45%" stop-color="#fff" stop-opacity="0.85"/>' +
  '<stop offset="100%" stop-color="#fff" stop-opacity="0"/>' +
  '</linearGradient></defs>' +
  '<path d="M0,40 L32.5,5.8 Q38,0 43.5,5.8 L76,40 Z" fill="url(#f)"/>' +
  '</svg>';
const ARROW_MASK_URL = `url("data:image/svg+xml,${encodeURIComponent(ARROW_MASK_SVG)}")`;

// filter:blur()는 mask-image보다 먼저 적용되고, 그 위에 마스크가 다시 선명한 벡터
// 모양으로 잘라내 버려서 같은 엘리먼트에 둘 다 걸면 블러가 안 보인다. 그래서 도형+색을
// 담는 안쪽 엘리먼트(paletteExpandArrowFill)와, 그 결과물 전체를 블러 처리하는
// 바깥 래퍼(paletteExpandArrow)로 나눈다.
const paletteExpandArrow = document.createElement('button');
paletteExpandArrow.setAttribute('aria-label', '전체 색상 보기');
paletteExpandArrow.style.position = 'fixed';
paletteExpandArrow.style.bottom = '124px';
paletteExpandArrow.style.left = '50%';
paletteExpandArrow.style.zIndex = '1001';
paletteExpandArrow.style.width = '76px';
paletteExpandArrow.style.height = '40px';
paletteExpandArrow.style.border = 'none';
paletteExpandArrow.style.padding = '0';
paletteExpandArrow.style.background = 'transparent';
paletteExpandArrow.style.cursor = 'pointer';
paletteExpandArrow.style.opacity = '0';
paletteExpandArrow.style.pointerEvents = 'none';
paletteExpandArrow.style.transform = 'translateX(-50%) rotate(0deg)';
paletteExpandArrow.style.filter = 'blur(3.5px)';
paletteExpandArrow.style.transition = 'opacity 0.4s ease, transform 0.3s ease, bottom 0.35s cubic-bezier(0.22, 1, 0.36, 1)';
document.body.appendChild(paletteExpandArrow);

const paletteExpandArrowFill = document.createElement('div');
paletteExpandArrowFill.style.position = 'absolute';
paletteExpandArrowFill.style.inset = '0';
// 글자(▲) 대신 도형 자체를 팔레트 그림자 색으로 채운다(색/투명도는 updatePaletteShadowColor에서 지정).
paletteExpandArrowFill.style.background = 'transparent';
paletteExpandArrowFill.style.transition = 'background 0.4s ease';
paletteExpandArrowFill.style.maskImage = ARROW_MASK_URL;
paletteExpandArrowFill.style.webkitMaskImage = ARROW_MASK_URL;
paletteExpandArrowFill.style.maskSize = '100% 100%';
paletteExpandArrowFill.style.webkitMaskSize = '100% 100%';
paletteExpandArrowFill.style.maskRepeat = 'no-repeat';
paletteExpandArrowFill.style.webkitMaskRepeat = 'no-repeat';
paletteExpandArrow.appendChild(paletteExpandArrowFill);

// 화면 맨 하단의 Warm/Cool 탭: 계절 팔레트 대신 웜톤(봄+가을) 또는 쿨톤(여름+겨울) 전체를 보여준다.
// 튜토리얼을 거쳐 실전 모드로 들어왔을 때만 보이며(isPracticeMode), 카드를 직접 클릭한
// 평소 흐름에서는 쓰지 않는다.
const paletteToneTabs = document.createElement('div');
paletteToneTabs.style.position = 'fixed';
paletteToneTabs.style.bottom = '22px';
paletteToneTabs.style.left = '50%';
paletteToneTabs.style.transform = 'translateX(-50%)';
paletteToneTabs.style.zIndex = '1001';
paletteToneTabs.style.display = 'flex';
paletteToneTabs.style.flexWrap = 'wrap';
paletteToneTabs.style.justifyContent = 'center';
// position:fixed 요소는 width:auto면 내용에 맞춰 줄어드는(shrink-to-fit) 폭을
// 갖는데, 그러면 실제로 쓸 수 있는 가로 공간을 다 활용하지 못한 채로 줄바꿈
// 여부가 정해져 짧은 탭 4개도 두 줄로 밀려날 수 있다. width:100%를 줘서
// max-width까지 실제로 넓게 펴진 뒤에만 줄바꿈이 필요할 때 일어나게 한다.
paletteToneTabs.style.width = '100%';
paletteToneTabs.style.maxWidth = 'min(640px, 92vw)';
paletteToneTabs.style.gap = '20px';
paletteToneTabs.style.opacity = '0';
paletteToneTabs.style.pointerEvents = 'none';
paletteToneTabs.style.transition = 'opacity 0.4s ease';
document.body.appendChild(paletteToneTabs);

// 'tone'(웜/쿨) | 'value'(명도 단계) — "선택" 버튼으로 넘어가는 실전 단계.
let practiceStage = 'tone';
let toneTabButtons = [];

function makeStageTabButton(label, mode) {
  const tab = document.createElement('button');
  tab.textContent = label;
  tab.dataset.mode = mode;
  tab.style.background = 'transparent';
  tab.style.border = 'none';
  tab.style.fontSize = '12px';
  tab.style.letterSpacing = '0.04em';
  tab.style.cursor = 'pointer';
  tab.style.padding = '4px 2px';
  tab.addEventListener('click', (e) => {
    e.stopPropagation();
    // 종합 단계의 계절 탭은 코브플로우 팔레트가 아니라 색 구름 배경 자체를 그 계절
    // 색으로만 다시 그린다.
    if (mode.startsWith('season')) {
      const seasonIndex = parseInt(mode.slice('season'.length), 10);
      renderSynthesisBackdrop(seasonIndex);
      setSynthesisBackgroundColor(seasonIndex);
      currentPaletteMode = mode;
      updateToneTabsActive();
      return;
    }
    // 확정한 색 화면 안에 있을 때는 어떤 탭(웜/쿨/명도 단계)을 눌러도 전체 팔레트로
    // 나가지 않고, 확정한 색들 중 그 탭에 해당하는 것만 걸러 보여준다.
    if (currentPaletteMode.startsWith('confirmed')) {
      setPaletteMode(`confirmed-${mode}`);
    } else {
      setPaletteMode(mode);
    }
  });
  paletteToneTabs.appendChild(tab);
  toneTabButtons.push(tab);
  return tab;
}

// 지금 단계(웜/쿨 또는 명도)에 맞는 탭 버튼들을 다시 그린다.
function renderStageTabs() {
  paletteToneTabs.innerHTML = '';
  toneTabButtons = [];
  // 모바일 폭에서는 "Deepest/Deep/Light/Lightest"처럼 긴 라벨 4개가 한 줄에 못
  // 들어가 둘째 줄로 밀려났다. 글자 크기와 간격을 줄여 한 줄에 들어가게 한다.
  const isNarrow = window.innerWidth < 480;
  if (practiceStage === 'value') {
    paletteToneTabs.style.gap = isNarrow ? '4px 10px' : '20px';
    VALUE_LEVEL_LABELS.forEach((label, i) => {
      const tab = makeStageTabButton(label, `value${i}`);
      if (isNarrow) {
        tab.style.fontSize = '10.5px';
        tab.style.padding = '3px 1px';
      }
    });
  } else if (practiceStage === 'chroma') {
    paletteToneTabs.style.gap = isNarrow ? '4px 10px' : '20px';
    CHROMA_LEVEL_LABELS.forEach((label, i) => {
      const tab = makeStageTabButton(label, `chroma${i}`);
      if (isNarrow) {
        tab.style.fontSize = '10.5px';
        tab.style.padding = '3px 1px';
      }
    });
  } else if (practiceStage === 'synthesis') {
    // 16타입은 한 줄에 다 못 들어가므로 줄바꿈하고, 4개(같은 계절)씩 묶어 보이도록
    // 그룹 경계에서만 간격을 살짝 더 준다.
    paletteToneTabs.style.gap = '6px 14px';
    SEASON16_TAB_LABELS.forEach((label, i) => {
      const tab = makeStageTabButton(label, `season${i}`);
      tab.style.fontSize = '10.5px';
      tab.style.padding = '3px 1px';
      if (i > 0 && i % 4 === 0) tab.style.marginLeft = '10px';
    });
  } else {
    paletteToneTabs.style.gap = '20px';
    makeStageTabButton('Warm', 'warm');
    makeStageTabButton('Cool', 'cool');
  }
  updateToneTabsActive();
  updateToneTabsContrast(currentColor);
}
renderStageTabs();

function updateToneTabsActive() {
  toneTabButtons.forEach((tab) => {
    const mode = tab.dataset.mode;
    const active = currentPaletteMode === mode || currentPaletteMode === `confirmed-${mode}`;
    tab.style.opacity = active ? '1' : '0.5';
    tab.style.fontWeight = active ? '700' : '400';
  });
}

// 배경색 명도에 맞춰 탭 글씨 색도 뒤로가기 버튼과 같은 규칙으로 바꾼다.
function updateToneTabsContrast(color) {
  const { l } = hexToHSL(color);
  const textColor = l < 50 ? '#ffffff' : '#111111';
  toneTabButtons.forEach((tab) => { tab.style.color = textColor; });
}

// 스와치 자체에 "뚫어놓은" 듯한 체크 표시(마스크)와, 확정 후의 원형 표시.
// 흰 부분은 그대로 보이고 검은 부분은 투명해지는 CSS mask 원리를 이용해, 스와치 색을
// 배경 삼아 체크 모양만 뻥 뚫려 뒤(팔레트 아래 깔린 화면색)가 비쳐 보이게 한다.
// backdrop-filter의 blur는 뒤가 단색(평평한 화면 색)이면 티가 안 나서, 마스크
// 모양 자체에 SVG 가우시안 블러를 걸어 구멍의 가장자리가 또렷한 선이 아니라
// 뿌옇게 번지도록 만든다 — 이게 실제로 눈에 보이는 "블러" 효과를 만든다.
const SWATCH_MASK_BLUR_FILTER = '<filter id="b"><feGaussianBlur stdDeviation="1.6"/></filter>';

const SWATCH_CHECK_MASK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">' +
  `<defs>${SWATCH_MASK_BLUR_FILTER}</defs>` +
  '<rect width="40" height="40" fill="white"/>' +
  '<path d="M11 21l6.5 6.5L29 13" stroke="black" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none" filter="url(#b)"/>' +
  '</svg>';
const SWATCH_CHECK_MASK_URL = `url("data:image/svg+xml,${encodeURIComponent(SWATCH_CHECK_MASK_SVG)}")`;

const SWATCH_CONFIRMED_MASK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">' +
  `<defs>${SWATCH_MASK_BLUR_FILTER}</defs>` +
  '<rect width="40" height="40" fill="white"/>' +
  '<circle cx="20" cy="20" r="7" fill="black" filter="url(#b)"/>' +
  '</svg>';
const SWATCH_CONFIRMED_MASK_URL = `url("data:image/svg+xml,${encodeURIComponent(SWATCH_CONFIRMED_MASK_SVG)}")`;

// 실전 모드의 스와치에만 체크(또는 확정된 색이면 원형) 구멍을 뚫는다. 코브플로우가 이미
// 중앙으로 올수록 스와치 자체를 선명하게(블러/투명도↓) 만들어주므로, 이 구멍도 자연히
// 중앙에 올 때 또렷해지고 옆으로 갈수록 흐려진다 — 스와치와 한 몸이기 때문이다.
function updateSwatchCheckMask(swatch, color) {
  const hole = swatch.holeEl;
  if (!hole) return;
  if (!isPracticeMode) {
    hole.style.maskImage = 'none';
    hole.style.webkitMaskImage = 'none';
    return;
  }
  const isConfirmed = confirmedColors.some((c) => c.toLowerCase() === color.toLowerCase());
  const maskUrl = isConfirmed ? SWATCH_CONFIRMED_MASK_URL : SWATCH_CHECK_MASK_URL;
  hole.style.maskImage = maskUrl;
  hole.style.webkitMaskImage = maskUrl;
  hole.style.maskSize = '100% 100%';
  hole.style.webkitMaskSize = '100% 100%';
  hole.style.maskRepeat = 'no-repeat';
  hole.style.webkitMaskRepeat = 'no-repeat';
  // 기본값(alpha 모드)에서는 흰색/검은색이 전부 "불투명"이라 뚫리지 않는다.
  // 명도(luminance) 기준으로 구멍을 뚫도록 명시해야 검은 부분이 실제로 비친다.
  hole.style.maskMode = 'luminance';
  hole.style.webkitMaskMode = 'luminance';
}

// 확정된 색의 원형 표시는 위치와 무관하게 항상 드러나 있고(마개 없음), 아직 확정 전인
// 체크 표시는 그 스와치가 중앙에 와 있을 때만 마개가 사라지며 자연스럽게 나타난다.
function updateSwatchCheckPlug(swatch, idx, color) {
  if (!swatch.plugEl) return;
  if (!isPracticeMode) {
    swatch.plugEl.style.opacity = '1';
    return;
  }
  const isConfirmed = confirmedColors.some((c) => c.toLowerCase() === color.toLowerCase());
  if (isConfirmed) {
    swatch.plugEl.style.opacity = '0';
    return;
  }
  swatch.plugEl.style.opacity = idx === currentPaletteIndex ? '0' : '1';
}

// 우측 상단의 팔레트(확정 색 목록) 아이콘. 튜토리얼 아이콘과 같은 자리를 쓰되,
// 실전 모드에서만 나타난다.
const paletteViewButton = document.createElement('button');
paletteViewButton.className = 'palette-view-button';
paletteViewButton.setAttribute('aria-label', '확정한 색 보기');
paletteViewButton.style.position = 'fixed';
paletteViewButton.style.top = 'calc(28px + env(safe-area-inset-top))';
paletteViewButton.style.right = 'calc(28px + env(safe-area-inset-right))';
paletteViewButton.style.zIndex = '1002';
paletteViewButton.style.background = 'transparent';
paletteViewButton.style.border = 'none';
paletteViewButton.style.padding = '0';
// 정확히 정사각형으로 고정해야 발광(border-radius:50%)이 타원이 아니라 진짜 원으로 보인다
// (버튼 안 SVG를 인라인 콘텐츠로만 두면 베이스라인 여백 때문에 세로로 살짝 더 커진다).
paletteViewButton.style.width = '32px';
paletteViewButton.style.height = '32px';
paletteViewButton.style.display = 'flex';
paletteViewButton.style.alignItems = 'center';
paletteViewButton.style.justifyContent = 'center';
paletteViewButton.style.cursor = 'pointer';
paletteViewButton.style.opacity = '0';
paletteViewButton.style.pointerEvents = 'none';
paletteViewButton.style.transition = 'opacity 0.3s ease';
// PNG 아이콘은 SVG의 currentColor처럼 색을 못 받아오므로, mask-image로 아이콘
// 모양만 따와서 배경색(currentColor)을 채운다. 그러면 기존처럼 배경 명도에 따라
// 흰색/검정으로 자동으로 뒤집히는 대비 효과가 그대로 유지된다.
paletteViewButton.innerHTML =
  '<div style="width:13px;height:14px;background-color:currentColor;' +
  '-webkit-mask-image:url(\'icon-palette.png\');mask-image:url(\'icon-palette.png\');' +
  '-webkit-mask-size:contain;mask-size:contain;' +
  '-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;' +
  '-webkit-mask-position:center;mask-position:center;"></div>';
document.body.appendChild(paletteViewButton);

// "선택" 텍스트: 눌러서 다음 단계(웜/쿨 → 명도)로 넘어간다. 팔레트 아이콘 왼쪽에 둔다.
const stageAdvanceButton = document.createElement('button');
stageAdvanceButton.className = 'stage-advance-button';
stageAdvanceButton.setAttribute('aria-label', '다음 단계로');
stageAdvanceButton.textContent = 'Select';
stageAdvanceButton.style.position = 'fixed';
stageAdvanceButton.style.top = 'calc(28px + env(safe-area-inset-top))';
stageAdvanceButton.style.right = 'calc(28px + env(safe-area-inset-right))';
stageAdvanceButton.style.zIndex = '1002';
stageAdvanceButton.style.height = '32px';
stageAdvanceButton.style.display = 'flex';
stageAdvanceButton.style.alignItems = 'center';
stageAdvanceButton.style.background = 'transparent';
stageAdvanceButton.style.border = 'none';
stageAdvanceButton.style.padding = '0';
stageAdvanceButton.style.fontSize = '13px';
stageAdvanceButton.style.letterSpacing = '0.02em';
stageAdvanceButton.style.cursor = 'pointer';
stageAdvanceButton.style.opacity = '0';
stageAdvanceButton.style.pointerEvents = 'none';
stageAdvanceButton.style.transition = 'opacity 0.3s ease';
document.body.appendChild(stageAdvanceButton);

// 단계 전환 전에 잠깐 보여주는 안내 문구(예전 튜토리얼의 드레이핑 설명을 그대로 다시 씀).
// "Select"를 누르면 화면 전체가 어둡게+블러 처리되며 이 문구가 뜨고, 그 위(배경)를
// 누르면 실제로 다음 단계 팔레트로 넘어간다.
// 얼굴 이미지는 나중에 실제 일러스트로 교체하기 전까지 쓰는 임시 자리표시자.
const HINT_FACE_PLACEHOLDER = 'face-placeholder.jpg';

const STAGE_HINTS = {
  value: {
    eyebrow: '단계 3 · 2차 드레이핑',
    heading: '명도',
    summary: '핵심은 안색이 밝아지는지 가라앉는지, 이목구비 윤곽이 또렷해지는지 흐려지는지, 얼굴과 색 중 어디로 시선이 먼저 가는지입니다.',
    cards: [
      {
        label: 'Light',
        good: '안색이 환해지고 피부 결이 매끄러워 보이며 이목구비가 부드럽게 살아납니다.',
        bad: '밝기에 얼굴이 밀려 이목구비가 흐려지고, 그늘이 진 것처럼 어두워지며 다크서클과 팔자 주름 음영이 짙어집니다.',
        goodImage: 'face-light-good.png',
        badImage: 'face-light-bad.png',
      },
      {
        label: 'Deep',
        good: '얼굴과의 대비로 윤곽이 또렷해지고 이목구비가 부각되며 인상에 안정감이 생깁니다.',
        bad: '색의 무게에 눌려 안색이 칙칙하게 가라앉고, 피부가 창백하거나 노랗게 떠 피곤하고 나이 들어 보입니다.',
        goodImage: 'face-deep-good.png',
        badImage: 'face-deep-bad.png',
      },
    ],
  },
  chroma: {
    eyebrow: '단계 4 · 3차 드레이핑',
    heading: '채도',
    summary: '핵심은 눈빛이 살아나는지 죽는지, 얼굴과 색 중 어느 쪽이 이기는지, 피부가 맑아지는지 흐려지는지입니다. 이목구비 대비가 강할수록 원색을, 부드러울수록 뮤트톤을 잘 소화하는 편입니다.',
    cards: [
      {
        label: 'Clear',
        good: '얼굴이 색에 지지 않고 생기가 돌며 눈동자와 눈빛이 또렷해지고, 얼굴이 색보다 먼저 시선을 끕니다.',
        bad: '색이 얼굴을 압도해 시선이 색으로만 가고, 얼굴이 밋밋해지며 잡티와 다크서클이 도드라져 보입니다.',
        goodImage: 'face-clear-good.png',
        badImage: 'face-clear-bad.png',
      },
      {
        label: 'Soft',
        good: '얼굴과 색이 자연스럽게 어우러져 편안하고 고급스러운 인상이 됩니다.',
        bad: '얼굴까지 같이 탁해져 흐릿하고 생기 없이, 피곤하거나 아파 보입니다.',
        goodImage: 'face-soft-good.png',
        badImage: 'face-soft-bad.png',
      },
    ],
  },
  synthesis: {
    eyebrow: '단계 5 · 종합',
    heading: '4계절 / 16계절 매핑',
    body: '언더톤, 명도, 채도 세 가지 결과를 조합하면 나의 시즌이 정해집니다. 마지막으로 확정된 시즌의 대표 팔레트를 다시 얼굴에 대보며 안색 투명도, 윤곽 선명도, 다크서클 변화를 교차 확인하면 결과가 더 정확해집니다.',
  },
  tone: {
    eyebrow: '단계 2 · 1차 드레이핑',
    heading: '언더톤',
    summary: '핵심은 혈색이 도는지 빠지는지, 다크서클과 잡티가 옅어지는지 짙어지는지, 치아와 눈흰자가 하얘 보이는지입니다.',
    cards: [
      {
        label: 'Warm',
        good: '피부에 노란빛 혈색이 자연스럽게 돌아 생기 있어 보이고, 다크서클이 브라운톤으로 묻히며, 피부 결도 매끈하게 정돈됩니다.',
        bad: '피부가 누렇게 뜨고 안색이 탁해지며, 치아까지 상대적으로 누레 보입니다.',
        goodImage: 'face-warm-good.png',
        badImage: 'face-warm-bad.png',
      },
      {
        label: 'Cool',
        good: '피부가 맑고 투명해지며 붉은기와 잡티가 중화되고, 눈흰자와 치아가 더 하얘 보입니다.',
        bad: '혈색이 빠진 듯 창백해지고 입술 주변이 푸르스름해지며, 다크서클과 붉은 반점이 오히려 도드라집니다.',
        goodImage: 'face-cool-good.png',
        badImage: 'face-cool-bad.png',
      },
    ],
  },
};
// 단계 순환 순서: 웜/쿨 → 명도 → 채도 → 종합(마지막, "Select"가 결과 분석으로 특별 동작).
const STAGE_ORDER = ['tone', 'value', 'chroma', 'synthesis'];
let pendingStageIntro = null;
// 튜토리얼을 막 마치고 처음 단계 2(언더톤) 안내 카드를 보여줄 때만 쓰는, 색 화면을
// 열 때 필요한 클릭 좌표(원 확장 애니메이션 기준점).
let pendingPracticeEntryPoint = null;
// 종합 단계에서 "Select"를 누르면 결과 문구가 뜨는데, 그 문구를 닫을 때(배경 클릭)
// 다음 단계로 넘어가는 대신 결과 모빌 화면을 보여줘야 하므로 별도로 기억해둔다.
let pendingFinalSeason = null;
// 홈 화면의 "결제하기"는 진단을 거치지 않은 상태에서 결제 화면을 미리 보여주는
// 용도라, 진짜 진단 결과(pendingFinalSeason)가 아니라 미리보기용으로 그 값을
// 잠깐 빌려 쓴다. 결제 없이(Back/배경 클릭) 닫으면 원래대로 null로 되돌려서,
// 이후 실제 진단 플로우(Select 버튼 등)를 막지 않게 한다.
let paymentOpenedFromHome = false;

// 단계 안내 카드 ↔ 색 화면을 오간 순서를 그대로 쌓아뒀다가, Back을 누르면 하나씩
// 꺼내서 정확히 바로 이전 화면으로 돌아가게 한다. 항목은 { type: 'hint'|'color', stage }.
let stageNavStack = [];
function pushStageNav(entry) { stageNavStack.push(entry); }
function goStageNavEntry(entry) {
  if (entry.type === 'hint') showStageHintScreen(entry.stage);
  else showStageColorScreen(entry.stage);
}

// 4계절(각 25색)을 명도 순으로 다시 4등분해 16타입으로 세분화한다. 계절별 순서는
// 밝은 쪽 끝부터 어두운 쪽 끝까지이며, 실제 16타입 진단에서 쓰는 이름을 그대로 붙였다.
const SEASON16_LABELS = [
  ['봄 페일', '봄 라이트', '봄 브라이트', '봄 비비드'],
  ['여름 페일', '여름 라이트', '여름 브라이트', '여름 뮤트'],
  ['가을 뮤트', '가을 스트롱', '가을 딥', '가을 다크'],
  ['겨울 비비드', '겨울 스트롱', '겨울 딥', '겨울 다크'],
];

// 타입별로 직접 지정한 30색 RGB HEX 팔레트. SEASON16_LABELS와 순서·이름이 정확히
// 같아야 한다(봄 페일→...→겨울 다크). 100색 마스터 팔레트에서 자동으로 잘라내던
// 예전 방식 대신, 이 고정 색상표를 그대로 각 타입의 팔레트로 쓴다.
const SEASON16_CUSTOM_COLORS = [
  // 봄 페일
  ['#FFF6E9', '#FFF1DC', '#FFEAD1', '#FFE3C8', '#FFDCC2', '#FFD5B8',
   '#FFCEB0', '#FFC7A8', '#FFC0A0', '#FFE9B8', '#FFE2A9', '#FFF4C1',
   '#FDEBD3', '#F9E9C8', '#F3E5C2', '#FFDFD3', '#FFD7CC', '#FFCFC0',
   '#FFC8B4', '#F6E7D8', '#EFE3D0', '#E9F0D9', '#E2EDCF', '#DCEAC6',
   '#E5F2DE', '#F0F5DD', '#FBEFE2', '#F8E4D8', '#F2DFC9', '#EDD9BE'],
  // 봄 라이트
  ['#FFB39B', '#FFA98F', '#FF9E85', '#FFAD90', '#FFBFA0', '#FFC98F',
   '#FFD37E', '#FFDD6E', '#F9D976', '#FFCF9E', '#FFC489', '#FFBA75',
   '#FFE08A', '#EDD87E', '#E8C99B', '#E0BE8A', '#D8B478', '#C6E377',
   '#B8DD6F', '#C9E4A0', '#A8E6CF', '#98E0C0', '#B5E6D8', '#9FE2E8',
   '#8EDCE6', '#FF9E9E', '#FFAFA8', '#FF8B77', '#FF7F66', '#FFD6C2'],
  // 봄 브라이트
  ['#FF7F50', '#FF6F4F', '#FF5E44', '#FF8A5C', '#FF9E4F', '#FFA726',
   '#FFB300', '#FFC400', '#FFD400', '#FFE135', '#F9E04B', '#FFAB40',
   '#FF9433', '#FF8243', '#9ACD32', '#8BC34A', '#7CB342', '#A6D944',
   '#66BB6A', '#40E0D0', '#26C6DA', '#00CED1', '#4DD0E1', '#35D0BA',
   '#FF7A85', '#FF6F6F', '#FF5A5F', '#F4442E', '#FF4040', '#FF9E7D'],
  // 봄 비비드
  ['#FF6600', '#FF5714', '#FF4500', '#FF6347', '#FF4030', '#F2300F',
   '#E63E1F', '#FF7518', '#FF8C00', '#FFA000', '#FFB800', '#FFC300',
   '#FFD000', '#FFDE00', '#C9D400', '#A4C400', '#76B900', '#58B000',
   '#3FA510', '#00C853', '#00C5CD', '#00BFD8', '#00ACC1', '#10CFC9',
   '#FF3D68', '#FF2D55', '#E8262D', '#FF5C39', '#FF7043', '#FF8F3C'],
  // 여름 페일
  ['#F8F8FF', '#F4F4FA', '#EFF1F7', '#E9EDF5', '#E2E8F2', '#D9E4F2',
   '#D6EBFF', '#CDE4FA', '#C4DDF5', '#E6E6FA', '#E0DEF5', '#DAD6F0',
   '#EFE3F5', '#EAD9F2', '#E5CFEF', '#FFE3EC', '#FCDCE7', '#F8D4E1',
   '#FBE4EE', '#F5DEE9', '#EFD8E4', '#E0F2EF', '#D8EEEA', '#D0EAE5',
   '#E8EAED', '#E1E4E9', '#DADEE4', '#F2EFF7', '#ECEAF3', '#E6E5EF'],
  // 여름 라이트
  ['#F4A7B9', '#F09CB0', '#EC91A7', '#F7B2C2', '#FABDCB', '#E8A2B8',
   '#DE97AE', '#C8A2C8', '#BE97BF', '#B48CB6', '#CFAAD1', '#D9B5DB',
   '#A7C7E7', '#9CBEE2', '#91B5DD', '#B0D2EC', '#BBD9F0', '#B0E0E6',
   '#A5D8DF', '#9AD0D8', '#B2DFDB', '#A7DAD5', '#9CD5CF', '#C1E4E1',
   '#D3A5BD', '#DDB0C6', '#E7BBCF', '#CBB8E0', '#C0ADD9', '#B5A2D2'],
  // 여름 브라이트
  ['#FF6EB4', '#FF5FA9', '#FF509E', '#F04393', '#E63788', '#FF7FBE',
   '#D32E5E', '#C82653', '#DC3A6B', '#E84878', '#4F86F7', '#4479EC',
   '#396CE1', '#5A93FC', '#659FFF', '#2E97DE', '#1F8AD3', '#3BA4E9',
   '#46B1F4', '#7B68EE', '#7059E3', '#8577F3', '#9B59B6', '#A96BC4',
   '#8E47A4', '#B77DD2', '#46C8C8', '#35BDBD', '#57D3D3', '#FF89C4'],
  // 여름 뮤트
  ['#C08081', '#B67576', '#AC6A6B', '#CA8B8C', '#D49697', '#B784A7',
   '#AC799C', '#A16E91', '#C28FB2', '#CD9ABD', '#8DA9C4', '#829EB9',
   '#7793AE', '#98B4CF', '#A3BFDA', '#AC9BB1', '#A190A6', '#96859B',
   '#B7A6BC', '#C2B1C7', '#9E9E9E', '#939393', '#888888', '#A9A9A9',
   '#B4B4B4', '#A5A0B0', '#9A95A5', '#8F8A9A', '#BFBAC5', '#CAC5D0'],
  // 가을 뮤트
  ['#D2B48C', '#C7A981', '#BC9E76', '#DDBF97', '#E8CAA2', '#C19A6B',
   '#B68F60', '#AB8455', '#CCA576', '#D7B081', '#E5DCC5', '#DAD1BA',
   '#CFC6AF', '#F0E7D0', '#EBE2CB', '#A99A6B', '#9E8F60', '#938455',
   '#B4A576', '#BFB081', '#8B7E66', '#80735B', '#756850', '#968971',
   '#A1947C', '#C4B49A', '#B9A98F', '#AE9E84', '#CFBFA5', '#DACAB0'],
  // 가을 스트롱
  ['#D4A017', '#C99512', '#BE8A0D', '#DFAB22', '#EAB62D', '#E2725B',
   '#D76750', '#CC5C45', '#ED7D66', '#F88871', '#708238', '#65772D',
   '#5A6C22', '#7B8D43', '#86984E', '#8E3B2F', '#833024', '#782519',
   '#994636', '#A45141', '#D57A2B', '#CA6F20', '#BF6415', '#E08536',
   '#EB9041', '#B85C38', '#AD512D', '#A24622', '#C36743', '#CE724E'],
  // 가을 딥
  ['#8B3A2F', '#802F24', '#752419', '#96453A', '#A15045', '#5D4037',
   '#52352C', '#473021', '#684B42', '#73564D', '#55613A', '#4A562F',
   '#3F4B24', '#606C45', '#6B7750', '#A67B5B', '#9B7050', '#906545',
   '#B18666', '#BC9171', '#7A4A32', '#6F3F27', '#64341C', '#85553D',
   '#905F48', '#4E3B31', '#433026', '#38251B', '#59463C', '#644F45'],
  // 가을 다크
  ['#3E2723', '#331C18', '#28110D', '#49322E', '#543D39', '#4A1F1A',
   '#3F140F', '#340904', '#552A25', '#603530', '#2E1D16', '#23120B',
   '#180700', '#392821', '#44332C', '#3B3A24', '#302F19', '#25240E',
   '#46452F', '#51503A', '#4B2C20', '#402115', '#35160A', '#56372B',
   '#614236', '#2B1E15', '#20130A', '#362920', '#41342B', '#4C3F36'],
  // 겨울 비비드
  ['#FF1493', '#F20087', '#E6007C', '#FF29A0', '#FF3EAD', '#0047AB',
   '#003DA0', '#003395', '#0051B6', '#005BC1', '#D40000', '#C90000',
   '#BE0000', '#DF0B0B', '#EA1616', '#009B77', '#00906C', '#008561',
   '#00A682', '#00B18D', '#7F00FF', '#7400F4', '#6900E9', '#8A0BFF',
   '#9516FF', '#000000', '#FFFFFF', '#00E5FF', '#00DAF4', '#FF0F6E'],
  // 겨울 스트롱
  ['#4169E1', '#365ED6', '#2B53CB', '#4C74EC', '#5781F7', '#C71585',
   '#BC0A7A', '#B1006F', '#D22090', '#DD2B9B', '#008B62', '#008057',
   '#00754C', '#00966D', '#00A178', '#0F52BA', '#0447AF', '#0A5DC5',
   '#1568D0', '#206FD5', '#8E4585', '#833A7A', '#78306F', '#995090',
   '#A45B9B', '#5D3FD3', '#5234C8', '#6845DE', '#B01030', '#A50525'],
  // 겨울 딥
  ['#1B2A4A', '#10203F', '#051534', '#263555', '#314060', '#3B1F47',
   '#30143C', '#250931', '#462A52', '#51355D', '#5A1F33', '#4F1428',
   '#44091D', '#652A3E', '#703549', '#36454F', '#2B3A44', '#203039',
   '#41505A', '#4C5B65', '#2C2C54', '#212149', '#16163E', '#0C0C33',
   '#37375F', '#42426A', '#1E3D58', '#13324D', '#284863', '#335370'],
  // 겨울 다크
  ['#000000', '#0A0A0A', '#141414', '#1E1E1E', '#282828', '#2B2B2B',
   '#363636', '#101820', '#0B131B', '#061016', '#1B232B', '#262E36',
   '#3B0A1E', '#300519', '#250014', '#461529', '#512034', '#0D0D2B',
   '#080826', '#030321', '#181836', '#232341', '#14001E', '#1E0529',
   '#291034', '#0F1419', '#1A1F24', '#060B10', '#252A2F', '#30353A'],
];

// 진단 중 실제로 화면에 뜨는(그리고 confirmedColors에 쌓이는) 색은 마스터 100색
// 팔레트(colors)에서 나온다. SEASON16_CUSTOM_COLORS는 마스터 팔레트와 무관한
// 지정 색상표라 confirmedColors와 절대 매칭이 안 되므로, "어느 타입을 가장 많이
// 골랐는지" 판정은 예전 방식대로 마스터 팔레트에서 계절별로 나눈 색상표를 따로
// 만들어서 쓴다(화면 표시용 SEASON16_CUSTOM_COLORS와는 별개).
const SEASON16_MATCH_COLORS = (() => {
  const segment = count / SEASON16_LABELS.length;
  const table = [];
  SEASON16_LABELS.forEach((labels, parentIdx) => {
    const seasonColors = colors.slice(parentIdx * segment, (parentIdx + 1) * segment);
    const sorted = [...seasonColors].sort((a, b) => hexToHSL(b).l - hexToHSL(a).l);
    const chunkSize = Math.ceil(sorted.length / labels.length);
    labels.forEach((name, i) => {
      table.push(sorted.slice(i * chunkSize, (i + 1) * chunkSize));
    });
  });
  return table;
})();

const SEASON16_GROUPS = (() => {
  const groups = [];
  SEASON16_LABELS.forEach((labels, parentIdx) => {
    labels.forEach((name, i) => {
      const flatIndex = parentIdx * labels.length + i;
      groups.push({
        name,
        parent: parentIdx,
        colors: SEASON16_CUSTOM_COLORS[flatIndex],
      });
    });
  });
  return groups;
})();
const SEASON16_NAMES = SEASON16_GROUPS.map((g) => g.name);

// 종합 단계 하단 탭에는 이 영문 이름을 쓴다(결과 화면 문구·팁 매칭은 위의 한글
// 이름을 그대로 쓰고, 탭 표시만 다른 화면들과 톤을 맞춰 영어로 보여준다).
const SEASON16_TAB_LABELS = [
  'Spring Pale', 'Spring Light', 'Spring Bright', 'Spring Vivid',
  'Summer Pale', 'Summer Light', 'Summer Bright', 'Summer Mute',
  'Autumn Mute', 'Autumn Strong', 'Autumn Deep', 'Autumn Dark',
  'Winter Vivid', 'Winter Strong', 'Winter Deep', 'Winter Dark',
];

// 지금까지 확정한 색들이 16타입 중 어디에 가장 많이 속하는지 세어 가장 많은 타입을 고른다.
function computeDominantSeason16() {
  const counts = new Array(SEASON16_GROUPS.length).fill(0);
  confirmedColors.forEach((hex) => {
    const idx = SEASON16_MATCH_COLORS.findIndex((groupColors) =>
      groupColors.some((c) => c.toLowerCase() === hex.toLowerCase())
    );
    if (idx === -1) return;
    counts[idx] += 1;
  });
  let winner = 0;
  for (let i = 1; i < counts.length; i++) {
    if (counts[i] > counts[winner]) winner = i;
  }
  return winner;
}

// 종합 단계의 배경: 흐릿하게 번진 원(블롭)들이 무작위로 흩뿌려진 채 왼쪽에서
// 오른쪽으로 천천히 흘러가는 화면. 16타입 중 고른 그룹의 색만 재료로 쓴다.
//
// 이전 버전은 원 하나하나를 <div>로 만들어 각각에 filter:blur를 걸었더니(개수가
// 많다 보니) 애니메이션이 매끄럽지 못하고 자꾸 끊겼다. 그래서 방식을 바꿔, 원들은
// 먼저 <canvas>에 미리 한 번 그려두고(정적 이미지), 블러도 그 이미지 전체에 딱
// 한 번만 건다. 실제로 매 프레임 움직이는 건 이 "이미 완성된 이미지" 레이어를
// transform으로 옮기는 것뿐이라, 브라우저가 GPU에서 그 레이어를 그대로 밀기만
// 하면 되어 훨씬 가볍고 끊기지 않는다.
const synthesisBackdrop = document.createElement('div');
synthesisBackdrop.style.position = 'fixed';
synthesisBackdrop.style.inset = '0';
synthesisBackdrop.style.zIndex = '1000';
synthesisBackdrop.style.overflow = 'hidden';
synthesisBackdrop.style.opacity = '0';
synthesisBackdrop.style.pointerEvents = 'none';
synthesisBackdrop.style.transition = 'opacity 0.5s ease';
document.body.appendChild(synthesisBackdrop);

let currentSynthesisSeasonIndex = 0;

// 화면 폭만큼의 "한 주기"에 해당하는 캔버스 이미지를 그린 뒤, 그 이미지를 통째로
// 오른쪽에 한 번 더 이어 붙이고 정확히 한 주기만큼 가로로 흘려보낸다. 두 이미지가
// 완전히 똑같으니 한 바퀴 돌면 이음매 없이 처음과 같아진다.
function renderSynthesisBackdrop(seasonIndex) {
  currentSynthesisSeasonIndex = seasonIndex;
  synthesisBackdrop.innerHTML = '';
  const groupColors = SEASON16_GROUPS[seasonIndex].colors;

  const W = window.innerWidth;
  const H = window.innerHeight;
  const isSmall = W < 480;
  const minSize = isSmall ? 170 : 230;
  const maxSize = isSmall ? 340 : 480;

  // 원 중심이 화면 변에 걸리면(블러가 얕아) 반원째로 잘려 보이므로, 원 중심 자체를
  // 화면 안쪽에만 두지 않고 가장자리 바깥 여백(MARGIN)까지 넓혀 흩뿌린다. 그러면
  // 변에 걸리는 원들도 중심이 아니라 가장자리의 완만한 호만 화면 안에 들어온다.
  const MARGIN = maxSize * 0.42;
  const spreadW = W + MARGIN * 2;
  const spreadH = H + MARGIN * 2;
  const seedOffset = seasonIndex * 971;
  const BLOB_COUNT = Math.max(46, Math.round((spreadW * spreadH) / 19000));
  const EDGE_SIZE = isSmall ? 340 : 460;
  const EDGE_PUSH = EDGE_SIZE * 0.3;

  const avgSize = (minSize + maxSize) / 2;
  const BLUR_PX = Math.round(avgSize * 0.16);
  // CSS blur는 원소 "안"만이 아니라 그 원소의 바깥 경계에서도 계산되는데, 경계
  // 바로 밖에는 아무것도 그려진 게 없어 브라우저가 그 부분을 투명으로 취급한다.
  // 캔버스를 화면 크기에 딱 맞게만 만들면 이 "경계 흐림"이 하필 화면 진짜 가장
  // 자리에서 일어나 허연 얼룩으로 보인다. 그래서 캔버스 자체를 블러 반경만큼
  // 화면보다 더 크게 그려서, 흐려지는 경계가 화면 밖(안 보이는 곳)에 오게 한다.
  const OVERHANG = Math.max(MARGIN, BLUR_PX * 3);

  // 씨드가 같으면(계절 인덱스로 결정) 두 번 그려도 완전히 같은 그림이 나오므로,
  // period/periodCopy용 캔버스를 각각 그려도(clone 대신) 픽셀이 정확히 일치한다.
  function drawPeriodCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvasW = W + OVERHANG * 2;
    const canvasH = H + OVERHANG * 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(canvasW * dpr));
    canvas.height = Math.max(1, Math.round(canvasH * dpr));
    canvas.style.position = 'absolute';
    canvas.style.left = `${-OVERHANG}px`;
    canvas.style.top = `${-OVERHANG}px`;
    canvas.style.width = `${canvasW}px`;
    canvas.style.height = `${canvasH}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    // 이 지점부터는 (0,0)이 화면의 진짜 (0,0)이 되도록 좌표를 다시 원점 이동한다.
    // 그러면 아래 원 배치 코드는 캔버스가 커진 걸 신경 쓸 필요 없이 그대로 쓴다.
    ctx.translate(OVERHANG, OVERHANG);

    // 원이 화면을 완전히 못 덮는 지점이 생기면 그 자리는 캔버스의 "빈 곳"(완전
    // 투명)으로 남는데, 여기에 블러를 걸면 투명한 곳 쪽으로 색이 옅어지면서 뒤에
    // 있는 흰 배경이 비쳐 가장자리가 허옇게 뜬다. 그래서 원을 그리기 전에 이
    // 그룹 색 중 하나로 캔버스 전체(여백 포함)를 먼저 채워, 완전히 투명한 픽셀이
    // 아예 생기지 않게 한다(빈틈이 있어도 팔레트 색이 보이지, 흰색이 보이지 않는다).
    ctx.fillStyle = groupColors[Math.floor(groupColors.length / 2)];
    ctx.fillRect(-OVERHANG, -OVERHANG, canvasW, canvasH);

    function drawCircle(color, x, y, size) {
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    function placeBlob(color, x, y, size) {
      drawCircle(color, x, y, size);
      // 좌우 가장자리 근처의 원은 반대쪽 가장자리에도 한 번 더 그려둔다. 가로로
      // 흐르다 한 주기를 돌아 이어질 때 이 원이 양쪽에 걸쳐 있어야 이음매에서
      // 빈틈 없이 자연스럽게 이어진다.
      if (x < size / 2) drawCircle(color, x + W, y, size);
      if (x > W - size / 2) drawCircle(color, x - W, y, size);
    }

    for (let i = 0; i < BLOB_COUNT; i++) {
      const sb = seedOffset + i * 17;
      const size = minSize + seeded(sb) * (maxSize - minSize);
      const x = -MARGIN + seeded(sb + 1) * spreadW;
      const y = -MARGIN + seeded(sb + 2) * spreadH;
      const color = groupColors[Math.floor(seeded(sb + 3) * groupColors.length) % groupColors.length];
      placeBlob(color, x, y, size);
    }

    // 화면 네 변은 무작위 배치만으로 빈틈이 남을 수 있어 큼직한 원으로 보강한다.
    // 중심을 변 위가 아니라 변 바깥으로 밀어둬서 잘린 반원 모양이 생기지 않게 한다.
    const EDGE_H_STEPS = Math.ceil(W / (EDGE_SIZE * 0.5)) + 1;
    for (let i = 0; i <= EDGE_H_STEPS; i++) {
      const x = (i / EDGE_H_STEPS) * W;
      placeBlob(groupColors[i % groupColors.length], x, -EDGE_PUSH, EDGE_SIZE);
      placeBlob(groupColors[(i + 2) % groupColors.length], x, H + EDGE_PUSH, EDGE_SIZE);
    }
    const EDGE_V_STEPS = Math.ceil(H / (EDGE_SIZE * 0.5)) + 1;
    for (let i = 0; i <= EDGE_V_STEPS; i++) {
      const y = (i / EDGE_V_STEPS) * H;
      placeBlob(groupColors[(i + 1) % groupColors.length], -EDGE_PUSH, y, EDGE_SIZE);
      placeBlob(groupColors[(i + 3) % groupColors.length], W + EDGE_PUSH, y, EDGE_SIZE);
    }

    return canvas;
  }

  const track = document.createElement('div');
  track.className = 'synthesis-track';
  track.style.position = 'absolute';
  track.style.left = '0';
  track.style.top = '0';
  track.style.width = `${W * 2}px`;
  track.style.height = '100%';
  // 블러는 개별 원이 아니라 이 트랙 전체(=이미 그려진 이미지 두 장)에 딱 한 번만
  // 걸어서, 실제 애니메이션 중에는 다시 계산할 필요 없이 GPU가 레이어만 옮기면 된다.
  track.style.filter = `blur(${BLUR_PX}px)`;
  track.style.willChange = 'transform';
  track.style.animation = `synthesisDrift ${Math.max(42, Math.round(W / 11))}s linear infinite`;

  const period = drawPeriodCanvas();
  const periodCopy = drawPeriodCanvas();
  // drawPeriodCanvas가 기본으로 준 left(-OVERHANG)에 W만 더해, 캔버스 자체의
  // 여백 오프셋은 유지한 채 "한 주기만큼 오른쪽"으로만 옮긴다.
  periodCopy.style.left = `${W - OVERHANG}px`;

  track.appendChild(period);
  track.appendChild(periodCopy);
  synthesisBackdrop.appendChild(track);
}

// 화면 크기가 바뀌면(회전, 리사이즈) 원 배치를 다시 계산해 새 크기에서도 빈틈이 없게 한다.
let synthesisResizeTimer = null;
window.addEventListener('resize', () => {
  if (synthesisBackdrop.style.opacity !== '1') return;
  clearTimeout(synthesisResizeTimer);
  synthesisResizeTimer = setTimeout(() => {
    renderSynthesisBackdrop(currentSynthesisSeasonIndex);
  }, 200);
});

// 배경색과, 그 위에 놓인 UI들의 명도 대비를 한 번에 맞춘다.
function applyBackgroundTone(color) {
  currentColor = color;
  colorOverlay.style.background = color;
  updateBackButtonContrast(color);
  updatePaletteViewButtonContrast(color);
  updateToneTabsContrast(color);
}

// 색 구름 뒤에 깔린 화면 배경도 지금 고른 16타입 그룹의 톤(연한 평균색)으로 맞춘다.
function setSynthesisBackgroundColor(seasonIndex) {
  applyBackgroundTone(paleFamilyColor(SEASON16_GROUPS[seasonIndex].colors));
}

// 종합 단계로 들어오면 팔레트 관련 UI를 모두 걷어내고 색 구름 배경만 보여준다.
// 여기서는 아이콘 대신 "Select"만 우측 상단에 계속 남아, 누르면 결과로 이어진다.
function enterSynthesisStage() {
  paletteBar.style.opacity = '0';
  paletteBar.style.pointerEvents = 'none';
  paletteCenterShadow.style.opacity = '0';
  paletteExpandArrow.style.opacity = '0';
  paletteExpandArrow.style.pointerEvents = 'none';
  paletteViewButton.style.opacity = '0';
  paletteViewButton.style.pointerEvents = 'none';

  // 하단 탭은 숨기지 않고 계절 4개로 다시 그려서, 눌렀을 때 한 계절 색만 화면 전체에 보이게 한다.
  renderStageTabs();
  currentPaletteMode = 'season0';
  renderSynthesisBackdrop(0);
  setSynthesisBackgroundColor(0);
  updateToneTabsActive();
  paletteToneTabs.style.opacity = '1';
  paletteToneTabs.style.pointerEvents = 'auto';

  synthesisBackdrop.style.opacity = '1';
  stageAdvanceButton.style.opacity = '1';
  stageAdvanceButton.style.pointerEvents = 'auto';
}

// 단계의 "색 화면"(팔레트 탐색 또는 종합 배경)을 보여준다. 안내 카드를 확인하고
// 다음 단계로 넘어갈 때와, Back으로 이전 단계에 다시 들어갈 때 모두 이 함수 하나로 처리한다.
function showStageColorScreen(stage) {
  const wasSynthesis = practiceStage === 'synthesis';
  practiceStage = stage;

  if (stage === 'synthesis') {
    enterSynthesisStage();
    return;
  }

  if (wasSynthesis) {
    // 종합 단계의 색 구름 배경을 걷고, 감춰뒀던 팔레트 관련 UI를 되돌린다.
    synthesisBackdrop.style.opacity = '0';
    synthesisBackdrop.style.pointerEvents = 'none';
    paletteBar.style.opacity = '1';
    paletteBar.style.pointerEvents = 'auto';
    paletteCenterShadow.style.opacity = '1';
    paletteExpandArrow.style.opacity = '1';
    paletteExpandArrow.style.pointerEvents = 'auto';
    paletteToneTabs.style.opacity = '1';
    paletteToneTabs.style.pointerEvents = 'auto';
  }

  renderStageTabs();
  const startModes = { value: 'value0', chroma: 'chroma0', tone: 'warm' };
  setPaletteMode(startModes[stage]);

  stageAdvanceButton.style.opacity = '0';
  stageAdvanceButton.style.pointerEvents = 'none';
  paletteViewButton.style.opacity = '1';
  paletteViewButton.style.pointerEvents = 'auto';
}

// 단계의 "안내 카드" 화면(Good/Bad 카드 또는 종합 요약)을 보여준다.
function showStageHintScreen(stage) {
  pendingStageIntro = stage;
  const hint = STAGE_HINTS[stage];
  stageHintEyebrow.textContent = hint.eyebrow;
  stageHintHeading.textContent = hint.heading;
  renderStageHintBody(hint);
  stageHintNextButton.style.display = '';
  stageHintOverlay.style.opacity = '1';
  stageHintOverlay.style.pointerEvents = 'auto';
}

// 우측 상단 "End": 결과 모빌 화면에서만 나타나고, 누르면 첫 화면으로 돌아간다.
const endButton = document.createElement('button');
endButton.setAttribute('aria-label', '종료하고 처음 화면으로');
endButton.textContent = 'End';
endButton.style.position = 'fixed';
endButton.style.top = 'calc(28px + env(safe-area-inset-top))';
endButton.style.right = 'calc(28px + env(safe-area-inset-right))';
endButton.style.zIndex = '1002';
endButton.style.background = 'transparent';
endButton.style.border = 'none';
endButton.style.fontSize = '13px';
endButton.style.letterSpacing = '0.02em';
endButton.style.color = '#111111';
endButton.style.cursor = 'pointer';
endButton.style.opacity = '0';
endButton.style.pointerEvents = 'none';
endButton.style.transition = 'opacity 0.3s ease';
document.body.appendChild(endButton);

// 결과로 나온 계절에 어울리는 메이크업/화장품 팁.
// 16타입별 상세 스타일링 팁. SEASON16_LABELS와 같은 순서(계절 안에서 밝은 쪽 →
// 어두운/짙은 쪽)로 정리했다.
const SEASON16_TIPS = [
  // 봄 페일
  {
    outfit: '크림 아이보리, 페일피치, 라이트코랄, 밀크옐로우 등 흰빛이 많이 섞인 파스텔 웜이 핵심입니다. 셔츠, 블라우스, 니트 등 얼굴에 가까운 상의는 반드시 이 계열로 유지하고, 네이비나 브라운 같은 딥 컬러는 하의·아우터로 내리세요. 소재는 빛을 부드럽게 반사하는 실크, 쉬폰, 고운 니트가 투명한 피부와 잘 어울립니다. 순백보다 크림화이트가 안색에 유리합니다.',
    makeup: [
      ['베이스', '핑크 기 없는 밝은 아이보리 톤을 얇게. 커버력보다 투명함이 우선이며, 세미매트보다 은은한 글로우 마무리가 피부 장점을 살립니다. 컨실러도 밝은 피치 톤으로 최소한만.'],
      ['아이브로우', '라이트브라운. 진한 브로우는 얼굴에서 눈썹만 떠 보이게 하므로 한 톤 연하게 그리세요.'],
      ['아이섀도', '샴페인, 피치, 라이트골드 펄을 얇게. 음영은 연한 웜베이지 정도로만 넣고 짙은 브라운 음영은 피합니다.'],
      ['치크', '연한 피치를 볼 중앙에 은은하게. 크림 치크로 안에서 배어나오는 혈색처럼 표현하면 최적입니다.'],
      ['립', '시어한 코랄, 피치 틴트나 립밤 제형. 매트 풀커버 립은 립만 동동 떠 보이므로 그라데이션으로 가볍게.'],
    ],
    hair: '밀크브라운, 라이트베이지브라운, 허니 기 도는 밝은 브라운이 잘 맞습니다. 애쉬 기가 강하거나 블루블랙처럼 어두운 컬러는 안색을 창백하게 만듭니다. 탈색 후 밝은 염색도 소화하는 편이지만 잿빛보다는 노란빛 기반으로.',
    jewelry: '은은한 광택의 옐로우골드, 로즈골드 소재의 얇고 섬세한 디자인이 좋습니다. 크림펄 진주도 잘 어울립니다. 실버가 필요하면 얼굴에서 먼 손목·반지 위주로 배치하세요. 안경테는 클리어, 라이트베이지, 골드 메탈 추천.',
    nail: '밀크피치, 시어코랄, 아이보리 등 반투명 컬러가 손을 깨끗하게 만듭니다. 시럽 젤이나 그라데이션처럼 투명감 있는 아트가 잘 어울리고, 어두운 풀코트는 손이 나이 들어 보일 수 있습니다.',
  },
  // 봄 라이트
  {
    outfit: '살구, 라이트옐로우, 연민트, 라이트코랄, 밝은 캐멀이 메인 팔레트입니다. 파스텔 웜끼리의 배색이나 아이보리와의 조합이 안전하면서 화사합니다. 데님은 밝은 워싱, 트렌치는 라이트베이지가 정석. 무거운 검정 코트보다 크림·카멜 코트가 얼굴을 살립니다.',
    makeup: [
      ['베이스', '옐로우베이스의 밝은 톤으로 촉촉하게. 쿠션이라면 글로우 타입, 마무리는 윤광.'],
      ['아이브로우', '웜브라운으로 부드럽게. 회갈색보다 노란기 있는 브라운이 자연스럽습니다.'],
      ['아이섀도', '살구, 코랄, 웜베이지 음영에 골드펄 포인트. 핑크 섀도를 쓰려면 피치핑크로.'],
      ['치크', '코랄 블러셔를 볼 앞쪽에 둥글게. 파우더보다 크림 제형이 촉촉한 베이스와 잘 붙습니다.'],
      ['립', '코랄핑크, 살구 컬러의 촉촉한 제형이 기본. 글로시나 새틴 마무리가 잘 맞고, 브릭·버건디처럼 무거운 색은 피하세요.'],
    ],
    hair: '라이트브라운, 허니브라운, 오렌지 기 살짝 도는 브라운이 안색과 잘 어우러집니다. 너무 어두운 흑발은 부드러운 인상을 가리므로 다크브라운까지만.',
    jewelry: '옐로우골드가 기본이며 얇은 체인, 작은 참 같은 가벼운 디자인이 좋습니다. 진주는 화이트펄보다 크림펄. 안경·선글라스 테는 라이트브라운, 클리어베이지, 골드 메탈이 부담 없습니다.',
    nail: '코랄, 살구, 크림옐로우, 밝은 웜핑크. 프렌치 네일은 화이트 대신 아이보리 팁으로 하면 손이 한층 화사합니다.',
  },
  // 봄 브라이트
  {
    outfit: '클리어코랄, 아쿠아블루, 옐로우그린, 브라이트옐로우처럼 맑고 채도 높은 컬러가 포인트입니다. 전신 무채색은 얼굴을 밋밋하게 만드니 상의, 스카프, 가방 어디든 선명한 컬러를 하나 넣으세요. 베이스 컬러는 검정보다 네이비·아이보리가 좋고, 광택 있는 소재도 잘 소화합니다.',
    makeup: [
      ['베이스', '맑은 옐로우베이스에 세미글로우 마무리. 칙칙함 없는 투명한 표현이 관건입니다.'],
      ['아이브로우', '미디엄 웜브라운으로 또렷하게. 흐릿한 눈썹은 이 타입의 또렷한 인상을 죽입니다.'],
      ['아이섀도', '반짝이는 골드·샴페인 펄, 글리터를 적극 활용하세요. 눈동자의 반짝임이 강점인 타입이라 펄이 과해 보이지 않습니다. 탁한 매트 브라운 음영은 최소로.'],
      ['치크', '선명한 코랄을 좁은 범위에 또렷하게. 흐리게 넓게 펴 바르면 생기가 죽습니다.'],
      ['립', '선명한 코랄레드, 오렌지레드가 베스트. 흐린 MLBB는 아파 보일 수 있습니다. 새틴이나 글로시 마무리로 맑기를 유지하세요.'],
    ],
    hair: '윤기 있는 브라운, 오렌지브라운, 카퍼 기 있는 밝은 브라운. 핵심은 톤의 맑기이므로 잿빛 애쉬 계열만 피하면 폭넓게 소화합니다.',
    jewelry: '광택이 확실한 폴리시드 골드가 잘 맞습니다. 컬러 스톤은 시트린, 페리도트, 코랄 등 맑은 웜 스톤으로. 귀걸이는 빛을 받아 반짝이는 드롭형이 얼굴의 생기를 더합니다.',
    nail: '선명한 코랄, 오렌지, 클리어레드. 유광 마감이 잘 맞고, 탁한 뉴트럴 톤보다 쨍한 컬러가 손을 어려 보이게 합니다.',
  },
  // 봄 비비드
  {
    outfit: '오렌지, 코랄레드, 애플그린, 브라이트터쿼이즈 같은 비비드 웜 원색이 주인공입니다. 베이직 위주로 입더라도 아우터나 상의 한 장은 비비드로 가져가세요. 베이스는 검정 대신 네이비, 브라운, 아이보리를 쓰면 원색이 더 살아납니다. 컬러 블로킹 배색도 소화하는 타입입니다.',
    makeup: [
      ['베이스', '잡티를 정돈한 세미매트~새틴 피부. 립에 힘을 주는 만큼 피부는 균일하고 깔끔하게.'],
      ['아이브로우', '또렷한 미디엄브라운. 강한 립과 균형을 맞출 수 있도록 형태를 명확히.'],
      ['아이섀도', '웜베이지로 깔끔하게 정리하거나 골드펄 포인트 정도. 립이 주인공이므로 눈은 과하지 않게.'],
      ['치크', '오렌지코랄을 소량, 또는 생략도 가능합니다. 립이 강할 땐 치크를 덜어내는 것이 세련됩니다.'],
      ['립', '이 타입 최고의 무기. 선명한 오렌지레드, 토마토레드를 풀커버 매트로 발라도 얼굴이 립에 지지 않습니다.'],
    ],
    hair: '윤기 있는 다크브라운부터 오렌지브라운, 카퍼까지 폭넓게 소화합니다. 잿빛 도는 컬러만 피하세요. 얼굴 대비가 강한 편이라 어두운 머리도 잘 받습니다.',
    jewelry: '존재감 있는 볼드 골드, 두꺼운 체인, 큼직한 이어링이 잘 어울립니다. 컬러가 들어간 과감한 디자인, 비즈나 에나멜 소재도 시도해볼 만합니다.',
    nail: '비비드 오렌지, 레드, 핫코랄 풀코트. 아트를 넣더라도 색 자체의 선명함은 유지하는 것이 포인트입니다.',
  },
  // 여름 페일
  {
    outfit: '아주 연한 라벤더, 베이비블루, 페일핑크, 오프화이트가 투명한 피부를 극대화합니다. 다크 컬러가 필요하면 검정 대신 라이트그레이, 소프트네이비로. 대비를 줄인 밝은 원톤 코디가 가장 잘 맞으며, 쉬폰·오간자처럼 가볍고 비치는 소재와 궁합이 좋습니다.',
    makeup: [
      ['베이스', '핑크베이스의 밝은 톤을 아주 얇게. 파우더로 뽀얗게 마무리한 세미매트가 피부의 투명감을 살립니다.'],
      ['아이브로우', '애쉬브라운이나 그레이브라운으로 연하게. 진한 갈색 눈썹은 인상을 무겁게 합니다.'],
      ['아이섀도', '페일핑크, 라벤더, 실버펄을 얇게. 음영 없이 색만 살짝 얹는 원컬러 섀도가 잘 어울립니다.'],
      ['치크', '연한 로즈핑크를 볼 바깥쪽에 흐리게. 붉은기가 도드라지지 않게 소량만.'],
      ['립', '시어한 로즈핑크, 라벤더핑크 틴트. 진한 립은 얼굴을 창백하게 만드니 그라데이션으로 가볍게.'],
    ],
    hair: '라이트 애쉬브라운, 애쉬베이지처럼 붉은 기 없는 밝은 컬러가 피부의 푸른 투명감과 어우러집니다. 오렌지·구릿빛 염색은 피부를 붉고 칙칙하게 만듭니다.',
    jewelry: '실버, 화이트골드의 얇고 섬세한 디자인, 은은한 화이트펄이 기본입니다. 광택 강한 볼드 골드는 피부와 부딪힙니다. 안경테는 클리어, 라벤더, 라이트그레이 추천.',
    nail: '밀키라벤더, 베이비핑크, 시어화이트. 채도 낮고 밝을수록 손이 희고 깨끗해 보입니다.',
  },
  // 여름 라이트
  {
    outfit: '로즈핑크, 스카이블루, 라일락, 민트가 시그니처 팔레트입니다. 순백 화이트가 잘 받는 타입이라 화이트+파스텔 조합이 가장 안전하고 예쁩니다. 데님은 연청, 아우터는 라이트그레이나 소프트네이비. 골드 버튼보다 실버 버튼 디테일이 어울립니다.',
    makeup: [
      ['베이스', '핑크베이스의 밝은 톤, 은은한 광이 도는 세미글로우. 노란기 도는 베이스는 안색을 탁하게 만듭니다.'],
      ['아이브로우', '애쉬브라운으로 부드럽게. 눈썹도 붉은기·노란기를 빼는 것이 통일감의 핵심입니다.'],
      ['아이섀도', '핑크, 모브, 라벤더 계열에 은은한 실버·핑크펄. 음영이 필요하면 핑크브라운으로.'],
      ['치크', '로즈핑크를 볼 중앙에서 관자놀이 방향으로 부드럽게. 파우더 타입이 무난하게 잘 붙습니다.'],
      ['립', '로즈, 핑크베이지의 촉촉한 새틴 제형이 기본. MLBB도 반드시 푸른 기 도는 로즈 계열로 고르세요.'],
    ],
    hair: '애쉬브라운, 로즈브라운 같은 붉은 기 없는 부드러운 톤. 흑발보다 다크 애쉬브라운이 인상을 부드럽게 만듭니다.',
    jewelry: '실버, 화이트골드, 화이트펄이 기본입니다. 파스텔 컬러 스톤이나 자개 소재도 잘 어울립니다. 안경테는 라벤더, 그레이, 실버 메탈.',
    nail: '로즈핑크, 라일락, 스카이블루 등 쿨 파스텔. 투명한 시럽 네일, 오로라 파우더 아트도 잘 받는 타입입니다.',
  },
  // 여름 브라이트
  {
    outfit: '클리어핑크, 밝은 블루, 라즈베리, 밝은 퍼플처럼 맑고 선명한 쿨 컬러로 포인트를 주세요. 화이트·네이비 베이스에 선명한 쿨 컬러 하나를 얹는 배색이 효과적입니다. 같은 선명한 색이라도 노란기가 섞이는 순간 어울림이 급격히 떨어지므로 푸른 기 도는 쪽을 고르는 것이 철칙입니다.',
    makeup: [
      ['베이스', '핑크베이스의 맑은 톤에 세미글로우. 칙칙함 없이 투명하게 표현하는 것이 우선입니다.'],
      ['아이브로우', '다크 애쉬브라운으로 또렷하게. 흐린 눈썹보다 형태가 분명한 쪽이 어울립니다.'],
      ['아이섀도', '깨끗한 실버·핑크 펄로 맑게. 글리터도 소화하며, 오렌지·브릭 계열만 피하면 됩니다.'],
      ['치크', '선명한 쿨핑크를 좁게 또렷하게. 흐린 발색보다 생기 있는 발색이 잘 맞습니다.'],
      ['립', '푸른 기 도는 선명한 핑크, 라즈베리, 푸시아핑크가 베스트. 새틴~글로시 마무리로 맑기를 살리세요.'],
    ],
    hair: '다크 애쉬브라운부터 블루블랙까지 소화합니다. 맑고 차가운 톤일수록 눈빛이 또렷해집니다. 노란빛 탈색모는 피하세요.',
    jewelry: '반짝임이 확실한 실버, 화이트골드, 큐빅·다이아몬드류 클리어 스톤이 잘 맞습니다. 광택 있는 심플한 디자인이 베스트.',
    nail: '선명한 핑크, 푸시아, 클리어블루. 유광 마감으로 쨍한 발색을 살리는 것이 좋습니다.',
  },
  // 여름 뮤트
  {
    outfit: '더스티핑크, 그레이시블루, 모브, 소프트그레이처럼 회색빛 섞인 톤이 얼굴과 하나처럼 어우러집니다. 톤온톤, 그라데이션 배색이 최고의 전략이며 니트·트위드·워싱 데님 같은 부드러운 질감과 궁합이 좋습니다. 쨍한 원색과 순수 검정은 얼굴을 눌러버리므로 검정 대신 차콜그레이를.',
    makeup: [
      ['베이스', '핑크베이스의 뉴트럴 톤, 소프트매트 마무리. 과한 광은 뮤트한 분위기와 어긋납니다.'],
      ['아이브로우', '그레이브라운, 애쉬브라운으로 결을 살려 자연스럽게.'],
      ['아이섀도', '말린 장미빛 로즈브라운, 더스티핑크, 모브 계열. 펄보다 매트·새틴 질감이 잘 붙습니다.'],
      ['치크', '더스티로즈를 넓고 흐리게. 경계 없이 스며들 듯 바르는 것이 포인트입니다.'],
      ['립', '뮤트로즈, MLBB 로즈브라운이 시그니처. 블러 처리된 매트 립이나 벨벳 제형이 특히 잘 어울립니다.'],
    ],
    hair: '애쉬브라운, 애쉬그레이 등 잿빛 섞인 컬러를 가장 잘 소화하는 대표 타입입니다. 윤기 강조보다 매트한 질감 연출이 분위기를 살립니다.',
    jewelry: '무광 실버, 새틴 마감 화이트골드, 흐린 빛의 담수 진주가 세련되게 어우러집니다. 반짝임이 강한 주얼리보다 담백한 디자인이 좋습니다.',
    nail: '더스티로즈, 그레이시모브, 뮤트베이지핑크. 무광 마감이 특히 고급스럽습니다.',
  },
  // 가을 뮤트
  {
    outfit: '베이지, 카멜, 오트밀, 소프트카키 등 낮은 채도의 웜 뉴트럴이 기본입니다. 니트, 스웨이드, 코듀로이, 리넨처럼 질감이 부드러운 소재와 만나면 시너지가 큽니다. 화이트는 순백 대신 에크루·오트밀로, 검정 대신 다크브라운으로 대체하면 전체 완성도가 올라갑니다.',
    makeup: [
      ['베이스', '옐로우베이스의 뉴트럴 톤, 세미매트 마무리. 뽀얗게 띄우기보다 피부 본연의 톤에 맞추는 것이 자연스럽습니다.'],
      ['아이브로우', '카키 기 도는 브라운으로 부드럽게. 눈썹까지 낮은 채도로 맞추면 통일감이 생깁니다.'],
      ['아이섀도', '베이지, 브라운, 카키골드의 음영 메이크업 최적 타입입니다. 펄은 은은한 골드펄까지만.'],
      ['치크', '누드베이지, 뮤트코랄을 볼 바깥쪽에 흐리게. 셰이딩과 자연스럽게 연결하면 얼굴에 깊이가 생깁니다.'],
      ['립', '누드베이지, 로지브라운 같은 채도 낮은 웜 컬러. 매트보다 새틴 질감이 건조해 보이지 않습니다. 형광기 있는 핑크는 얼굴과 분리됩니다.'],
    ],
    hair: '매트한 카키브라운, 베이지브라운이 잘 맞습니다. 너무 붉거나 너무 검은 컬러보다 중간 명도의 부드러운 브라운으로.',
    jewelry: '무광 골드, 앤티크 골드, 우드·가죽·라탄 소재 액세서리가 분위기를 살립니다. 화려한 스톤보다 소재감 있는 디자인이 좋습니다.',
    nail: '밀크티베이지, 토프, 소프트카키. 뉴트럴 계열의 무광 마감, 또는 마그네틱처럼 은은한 질감 아트 추천.',
  },
  // 가을 스트롱
  {
    outfit: '머스타드, 테라코타, 올리브그린, 버건디처럼 진하고 존재감 있는 웜 컬러를 주인공으로 쓰세요. 밝은 색이 필요할 땐 크림, 카멜처럼 깊이 있는 밝은 색으로. 연한 파스텔은 얼굴을 떠 보이게 합니다. 가죽 재킷, 트위드 등 무게감 있는 소재도 잘 소화합니다.',
    makeup: [
      ['베이스', '옐로우베이스, 새틴~세미매트 마무리로 균일하게. 혈색은 치크와 립에서 만드는 것이 깔끔합니다.'],
      ['아이브로우', '짙은 웜브라운으로 또렷하게. 강한 컬러 메이크업과 균형을 이루도록 형태를 분명히.'],
      ['아이섀도', '테라코타, 브릭, 카퍼 계열이 시그니처. 카퍼 펄을 눈 중앙에 얹으면 깊이와 화사함을 동시에 잡습니다.'],
      ['치크', '테라코타, 브릭 블러셔를 광대 아래쪽에 음영처럼. 셰이딩 겸용으로 활용해도 좋습니다.'],
      ['립', '브릭오렌지, 펌킨, 시나몬 컬러가 얼굴을 확 살립니다. 매트 제형도 잘 소화합니다.'],
    ],
    hair: '카퍼브라운, 레드브라운, 다크오렌지브라운 등 따뜻하고 진한 컬러가 강점을 부각시킵니다.',
    jewelry: '광택 있는 옐로우골드, 앰버·호박·타이거아이 같은 웜 스톤이 잘 맞습니다. 스카프나 가방에 머스타드·버건디 포인트를 넣는 것도 효과적입니다.',
    nail: '테라코타, 머스타드, 브릭레드. 딥한 웜 컬러의 유광 풀코트가 손을 세련되게 합니다.',
  },
  // 가을 딥
  {
    outfit: '브릭, 다크브라운, 딥카키, 다크캐멀이 중심입니다. 상의는 딥 웜 컬러로 얼굴의 안정감을 살리고, 전체적으로 어두운 톤온톤 코디가 잘 맞습니다. 검정보다 다크브라운이 안색에 유리하며, 코트·재킷 같은 겨울 아우터에서 특히 강한 타입입니다.',
    makeup: [
      ['베이스', '옐로우베이스의 차분한 톤, 세미매트로 결점 없이. 너무 밝은 호수는 목과 분리되어 보입니다.'],
      ['아이브로우', '다크브라운으로 진하고 자연스럽게.'],
      ['아이섀도', '딥브라운, 버건디브라운으로 음영을 깊게. 겹겹이 쌓는 그라데이션 음영을 잘 소화하는 타입입니다.'],
      ['치크', '뮤트브릭을 소량, 음영에 가깝게. 화사한 치크보다 차분한 혈색이 어울립니다.'],
      ['립', 'MLBB 브릭, 브라운레드가 시그니처. 아이라인·브로우까지 브라운 계열로 통일하면 부드러우면서 또렷한 인상이 완성됩니다.'],
    ],
    hair: '다크브라운, 초콜릿브라운이 기본. 밝은 염색보다 어두운 컬러가 이목구비를 살립니다.',
    jewelry: '앤티크 골드, 브론즈 톤이 잘 어울립니다. 가넷, 스모키쿼츠 같은 딥 웜 스톤 추천. 묵직한 시계나 가죽 스트랩도 좋은 선택입니다.',
    nail: '브릭, 딥브라운, 버건디브라운. 어두운 컬러 풀코트를 무겁지 않게 소화하는 타입입니다.',
  },
  // 가을 다크
  {
    outfit: '다크초콜릿, 딥버건디, 브라운블랙 등 명도가 가장 낮은 웜 컬러가 시그니처입니다. 검정을 소화하는 드문 웜톤이지만 순수 검정보다 브라운블랙이 한 수 위입니다. 밝은 색은 이너나 하의로 소량만 쓰고, 전체를 어둡게 톤온톤으로 정리하는 것이 가장 세련됩니다.',
    makeup: [
      ['베이스', '옐로우베이스의 본연 톤, 매트~세미매트. 어두운 의상과 어울리는 균일하고 단단한 피부 표현이 좋습니다.'],
      ['아이브로우', '다크브라운~브라운블랙으로 진하게.'],
      ['아이섀도', '브라운 베이스의 스모키를 잘 소화합니다. 다크브라운, 딥버건디로 깊이 있는 눈매를.'],
      ['치크', '생략하거나 브릭을 아주 소량. 립과 눈에 무게가 실리는 만큼 치크는 덜어냅니다.'],
      ['립', '버건디, 다크브라운 립을 풀커버로 발라도 얼굴이 지지 않는 타입입니다. 매트 제형까지 소화합니다.'],
    ],
    hair: '흑갈색, 다크브라운, 딥레드브라운. 어두울수록 얼굴이 또렷해집니다. 밝은 염색은 강점인 깊이를 없앱니다.',
    jewelry: '묵직한 골드, 브론즈, 가죽 소재의 볼드한 디자인이 잘 맞습니다. 작고 반짝이는 것보다 크고 무게감 있는 쪽이 균형이 맞습니다.',
    nail: '딥버건디, 다크초콜릿, 블랙브라운. 무광 또는 새틴 마감이 고급스럽습니다.',
  },
  // 겨울 비비드
  {
    outfit: '푸시아, 코발트블루, 트루레드 같은 쿨 원색이 주인공입니다. 화이트·블랙 베이스에 비비드 컬러 하나를 얹는 배색이 가장 강력하며, 애매한 중간색은 인상을 흐립니다. 광택 있는 소재, 새틴, 레더도 잘 소화합니다.',
    makeup: [
      ['베이스', '핑크베이스의 맑은 톤, 세미매트로 결점 없이 깨끗하게. 립이 주인공이 될 수 있도록 피부는 균일하게.'],
      ['아이브로우', '다크브라운~블랙브라운으로 또렷하게.'],
      ['아이섀도', '실버펄이나 쿨그레이로 깔끔하게 정리. 립에 힘을 주는 원포인트 전략이 베스트입니다.'],
      ['치크', '생략하거나 쿨핑크를 아주 소량. 치크가 강하면 립의 임팩트가 분산됩니다.'],
      ['립', '푸른 기 도는 트루레드, 푸시아를 선명한 풀커버로. 이 타입의 메이크업은 립 하나로 완성됩니다.'],
    ],
    hair: '블루블랙, 순수 흑발이 최고의 컬러입니다. 어중간한 브라운 염색은 오히려 인상을 약하게 만듭니다.',
    jewelry: '광택 강한 실버, 화이트골드, 다이아몬드·큐빅처럼 반짝임이 확실한 소재가 잘 맞습니다. 대비가 큰 블랙×실버 조합도 좋습니다.',
    nail: '트루레드, 푸시아, 클리어한 원색. 화이트·블랙을 활용한 대비 강한 아트도 잘 어울립니다.',
  },
  // 겨울 스트롱
  {
    outfit: '로얄블루, 딥푸시아, 에메랄드처럼 진하면서 채도가 살아있는 컬러가 중심입니다. 배색은 화이트·블랙의 대비 조합이 효과적이고, 중간 명도의 애매한 색은 매력을 반감시킵니다. 테일러드 재킷, 셔츠처럼 각 잡힌 실루엣과 궁합이 좋습니다.',
    makeup: [
      ['베이스', '핑크베이스, 세미매트의 단단하고 깨끗한 피부 표현.'],
      ['아이브로우', '블랙브라운으로 형태를 분명하게.'],
      ['아이섀도', '쿨그레이, 플럼 계열로 깊이를 주고 블랙 아이라인으로 또렷하게. 눈매 대비를 살리는 것이 핵심입니다.'],
      ['치크', '쿨핑크를 가볍게, 또는 생략. 얼굴의 대비 구조를 흐리지 않는 선에서만.'],
      ['립', '선명한 쿨레드, 플럼, 딥푸시아. 새틴~매트 제형으로 발색을 확실하게.'],
    ],
    hair: '흑발, 블루블랙, 다크애쉬. 차갑고 어두운 톤이 이목구비 대비를 극대화합니다.',
    jewelry: '실버, 화이트골드에 사파이어·에메랄드 같은 진한 컬러 스톤이 잘 맞습니다. 구조적이고 모던한 디자인 추천.',
    nail: '로얄블루, 딥푸시아, 에메랄드그린. 진하고 선명한 컬러의 유광 마감이 좋습니다.',
  },
  // 겨울 딥
  {
    outfit: '네이비, 다크퍼플, 와인, 차콜이 중심입니다. 얼굴 가까이는 딥 쿨 컬러, 밝은 색은 이너나 하의로 배치하세요. 파스텔을 얼굴 옆에 두면 창백해 보입니다. 다크 톤온톤에 실버 액세서리로 포인트를 주는 조합이 정석입니다.',
    makeup: [
      ['베이스', '핑크베이스의 차분한 톤, 세미매트. 어두운 의상에 지지 않는 균일한 피부가 중요합니다.'],
      ['아이브로우', '블랙브라운으로 진하게.'],
      ['아이섀도', '차콜, 딥퍼플, 플럼으로 깊이 있는 음영. 스모키 메이크업을 세련되게 소화하는 타입입니다.'],
      ['치크', '뮤트플럼을 아주 소량, 혹은 생략.'],
      ['립', '와인, 플럼이 시그니처. 벨벳~매트 제형의 딥한 발색이 얼굴의 대비를 살립니다.'],
    ],
    hair: '블루블랙, 다크네이비블랙. 어둡고 차가운 컬러가 얼굴의 대비를 살립니다.',
    jewelry: '실버, 백금에 오닉스·자수정 같은 딥 스톤이 잘 어울립니다. 미니멀하면서 소재가 좋은 디자인 추천.',
    nail: '와인, 네이비, 딥퍼플. 딥 컬러 풀코트가 손을 시크하게 만듭니다.',
  },
  // 겨울 다크
  {
    outfit: '블랙, 차콜, 딥네이비 등 가장 낮은 명도의 컬러를 완벽하게 소화하는 타입입니다. 올블랙 코디가 가장 잘 받으며, 립이나 액세서리로 쿨 포인트 하나를 더하면 무거워 보이지 않습니다. 레더, 울 코트 등 무게감 있는 소재와 궁합이 최상입니다.',
    makeup: [
      ['베이스', '핑크베이스, 매트~세미매트의 단단한 피부 표현. 어두운 의상과의 대비로 피부가 더 깨끗해 보입니다.'],
      ['아이브로우', '블랙~블랙브라운으로 강하게.'],
      ['아이섀도', '블랙 아이라인이 핵심입니다. 섀도는 차콜·쿨그레이로 정리하고 라인으로 대비를 만드세요.'],
      ['치크', '생략이 기본. 필요하면 쿨톤 셰이딩으로 윤곽만.'],
      ['립', '다크베리, 블랙체리, 딥와인까지 소화합니다. 매트 풀커버로 발라도 얼굴이 립을 이깁니다.'],
    ],
    hair: '순수 흑발, 블루블랙이 최적. 밝은 염색은 타입의 강점인 강한 대비를 무너뜨립니다.',
    jewelry: '광택 강한 실버, 블랙 스톤, 메탈릭한 볼드 디자인이 잘 맞습니다. 체인, 하드웨어 디테일도 좋은 선택입니다.',
    nail: '블랙, 차콜, 딥와인. 유광 블랙 네일을 가장 멋있게 소화하는 타입입니다.',
  },
];

endButton.addEventListener('click', () => {
  endButton.style.opacity = '0';
  endButton.style.pointerEvents = 'none';
  backButton.style.opacity = '0';
  backButton.style.pointerEvents = 'none';

  // 지금까지는 이 화면(색 배경)을 걷어내는 코드가 없어서, 아이콘만 돌아오고 실제
  // 첫 화면(메인 모빌)은 계속 색 배경에 가려져 있었다. 배경을 걷어 첫 화면을 되돌린다.
  const { x, y } = lastClickPoint;
  colorOverlay.style.transitionProperty = 'clip-path';
  colorOverlay.style.transitionDuration = '0.6s';
  colorOverlay.style.transitionTimingFunction = 'cubic-bezier(0.4, 0, 0.2, 1)';
  colorOverlay.style.clipPath = `circle(0px at ${x}px ${y}px)`;
  colorOverlay.style.pointerEvents = 'none';

  isPracticeMode = false;
  practiceStage = 'tone';
  stageNavStack = [];
  setHomeIconsOpacity('1');
});

// 튜토리얼 오버레이와 같은 방식(명도를 낮추고 블러)으로 화면 전체를 덮은 뒤 그 위에 문구를 띄운다.
// 패딩·정렬은 .tutorial-overlay와, 안쪽 문구 폭/간격은 .tutorial-slide와 동일하게 맞춘다.
const stageHintOverlay = document.createElement('div');
stageHintOverlay.style.position = 'fixed';
stageHintOverlay.style.inset = '0';
stageHintOverlay.style.zIndex = '1500';
stageHintOverlay.style.display = 'flex';
stageHintOverlay.style.alignItems = 'center';
stageHintOverlay.style.justifyContent = 'center';
stageHintOverlay.style.padding = '24px';
stageHintOverlay.style.textAlign = 'center';
stageHintOverlay.style.background = 'rgba(0, 0, 0, 0.45)';
stageHintOverlay.style.backdropFilter = 'blur(10px)';
stageHintOverlay.style.webkitBackdropFilter = 'blur(10px)';
stageHintOverlay.style.opacity = '0';
stageHintOverlay.style.pointerEvents = 'none';
stageHintOverlay.style.transition = 'opacity 0.4s ease';
stageHintOverlay.style.cursor = 'pointer';

const stageHintContent = document.createElement('div');
stageHintContent.style.display = 'flex';
stageHintContent.style.flexDirection = 'column';
stageHintContent.style.alignItems = 'center';
stageHintContent.style.gap = '26px';
stageHintContent.style.width = '100%';
stageHintContent.style.maxWidth = '760px';

const stageHintEyebrow = document.createElement('p');
stageHintEyebrow.className = 'tutorial-eyebrow';
const stageHintHeading = document.createElement('h3');
stageHintHeading.className = 'tutorial-heading';
const stageHintBody = document.createElement('p');
stageHintBody.className = 'tutorial-body';
stageHintBody.style.maxWidth = '480px';
const stageHintCards = document.createElement('div');
stageHintCards.className = 'hint-cards';

// 서류 안 얼굴 사진을 누르면 화면이 어두워지며 그 사진만 화면 중앙에 크게
// 떠오르는 라이트박스. 여러 서류/페이지에서 공유해서 쓰는 싱글턴이라 한
// 번만 만들어둔다.
const hintImageLightbox = document.createElement('div');
hintImageLightbox.className = 'hint-image-lightbox';
const hintImageLightboxImg = document.createElement('img');
hintImageLightbox.appendChild(hintImageLightboxImg);
hintImageLightbox.addEventListener('click', () => {
  hintImageLightbox.style.opacity = '0';
  hintImageLightbox.style.pointerEvents = 'none';
});
document.body.appendChild(hintImageLightbox);

function openHintImageLightbox(src) {
  hintImageLightboxImg.src = src;
  hintImageLightbox.style.opacity = '1';
  hintImageLightbox.style.pointerEvents = 'auto';
}

// 데스크탑: Good/Bad 뒤집기 카드 두 장 대신, 무채색 서류철처럼 생긴 문서 한
// 개를 보여준다. 라벨×Good/Bad 조합 4장(예: Warm-Good/Warm-Bad/Cool-Good/
// Cool-Bad)이 페이지로 들어있고, 페이지를 클릭하면 한 장씩 넘어간다. 우측에는
// 색인 탭이 튀어나와 있어(각 페이지 제목 표시) 원하는 페이지로 바로 건너뛸 수
// 있다. 얼굴 이미지는 나중에 실제 일러스트로 교체하기 전까지 쓰는 임시
// 자리표시자(HINT_FACE_PLACEHOLDER).
function buildHintDocument(cards) {
  const faces = [];
  cards.forEach((card) => {
    faces.push({ label: card.label, state: 'good', text: card.good, image: card.goodImage || HINT_FACE_PLACEHOLDER });
    faces.push({ label: card.label, state: 'bad', text: card.bad, image: card.badImage || HINT_FACE_PLACEHOLDER });
  });

  const doc = document.createElement('div');
  doc.className = 'hint-doc';

  const page = document.createElement('div');
  page.className = 'hint-doc-page';
  doc.appendChild(page);

  const tabs = document.createElement('div');
  tabs.className = 'hint-doc-tabs';
  doc.appendChild(tabs);

  let activeIndex = 0;

  // 서류 종이의 위치와 계단식 자리(0, 14, 28, 42px…)는 고정되어 있다. 갈피를
  // 고르면 종이가 아니라 갈피들의 자리가 바뀐다 — 선택된 갈피가 맨 앞(0번)
  // 자리로 오고, 그보다 앞(왼쪽)에 있던 갈피들은 순서를 유지한 채 맨 뒤로
  // 밀린다. 예: 1234에서 3을 고르면 3412가 된다(왼쪽으로 도는 순환).
  const TAB_STEP_PX = 14;
  const tabEls = faces.map((face, i) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'hint-doc-tab';
    tab.textContent = `${face.label} · ${face.state === 'good' ? 'Good' : 'Bad'}`;
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      goTo(i);
    });
    tabs.appendChild(tab);
    return tab;
  });

  function renderPage() {
    const face = faces[activeIndex];
    page.innerHTML = '';

    const index = document.createElement('p');
    index.className = 'hint-doc-page-index';
    index.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(faces.length).padStart(2, '0')}`;

    const label = document.createElement('p');
    label.className = 'hint-card-label';
    label.textContent = face.label;

    const separator = document.createElement('p');
    separator.className = 'hint-doc-title-separator';
    separator.textContent = ':';

    const badge = document.createElement('p');
    badge.className = 'hint-doc-badge' + (face.state === 'bad' ? ' bad' : '');
    badge.textContent = face.state === 'good' ? 'GOOD' : 'BAD';

    const titleRow = document.createElement('div');
    titleRow.className = 'hint-doc-title-row';
    titleRow.appendChild(label);
    titleRow.appendChild(separator);
    titleRow.appendChild(badge);

    // 클립이 사진 위쪽을 살짝 물고 있는 것처럼, 사진 위에 클립 이미지를
    // 겹쳐서 꽂아둔다. 사진을 누르면 라이트박스로 크게 볼 수 있다.
    const photoWrap = document.createElement('div');
    photoWrap.className = 'hint-doc-photo';

    const clip = document.createElement('img');
    clip.className = 'hint-doc-clip';
    clip.src = 'clip.png';
    clip.alt = '';

    const img = document.createElement('img');
    img.className = 'hint-card-illustration';
    img.src = face.image;
    img.alt = '';
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      openHintImageLightbox(face.image);
    });

    photoWrap.appendChild(clip);
    photoWrap.appendChild(img);

    const text = document.createElement('p');
    text.className = 'hint-card-text';
    text.textContent = face.text;

    page.appendChild(photoWrap);
    page.appendChild(titleRow);
    page.appendChild(text);
    page.appendChild(index);

    // 종이(서류)는 항상 제자리(0번 깊이)에 고정된다.
    page.style.transform = 'translateX(0)';

    const n = faces.length;
    tabEls.forEach((tab, i) => {
      const isActive = i === activeIndex;
      tab.classList.toggle('active', isActive);
      // 선택된 갈피가 0번(맨 앞) 자리로 오고, 나머지는 원래 순서를 유지한
      // 채 그 뒤로 한 칸씩 밀린다(왼쪽으로 도는 순환 이동).
      const slot = (i - activeIndex + n) % n;
      tab.style.marginLeft = `${slot * TAB_STEP_PX}px`;
      tab.style.zIndex = String(n - slot);
    });
  }

  function goTo(i) {
    if (i === activeIndex) return;
    activeIndex = i;
    renderPage();
  }

  page.addEventListener('click', (e) => {
    e.stopPropagation();
    goTo((activeIndex + 1) % faces.length);
  });

  renderPage();
  return doc;
}

// 명도/언더톤/채도처럼 두 축(Light-Deep 등)이 있는 단계는 카드 두 장을, 종합처럼
// 카드가 없는 단계는 기존 문구(stageHintBody)만 보여준다.
// 모바일에서는 카드 두 장(앞/뒤 뒤집기) 대신, 얼굴 4장(Deep-Good/Deep-Bad/
// Light-Good/Light-Bad처럼 축마다 Good·Bad 두 장씩)을 부채처럼 겹쳐 쌓아두고
// 좌우로 스와이프하며 한 장씩 넘겨보게 한다.
function buildMobileCardStack(cards) {
  const faces = [];
  cards.forEach((card) => {
    faces.push({ label: card.label, state: 'good', text: card.good, image: card.goodImage || HINT_FACE_PLACEHOLDER });
    faces.push({ label: card.label, state: 'bad', text: card.bad, image: card.badImage || HINT_FACE_PLACEHOLDER });
  });

  const stack = document.createElement('div');
  stack.className = 'hint-card-stack';

  let activeIndex = 0;

  const cardEls = faces.map((face) => {
    const el = document.createElement('div');
    el.className = 'hint-stack-card';

    const label = document.createElement('p');
    label.className = 'hint-card-label';
    label.textContent = face.label;

    const badge = document.createElement('p');
    badge.className = 'hint-stack-badge ' + (face.state === 'good' ? 'good' : 'bad');
    badge.textContent = face.state === 'good' ? 'Good' : 'Bad';

    const img = document.createElement('img');
    img.className = 'hint-card-illustration';
    img.src = face.image;
    img.alt = '';

    const text = document.createElement('p');
    text.className = 'hint-card-text';
    text.textContent = face.text;

    el.appendChild(label);
    el.appendChild(badge);
    el.appendChild(img);
    el.appendChild(text);
    stack.appendChild(el);
    return el;
  });

  // 카드 뭉치는 제자리에 고정되어 있고, 뒤에 겹쳐 있는 카드들은 각자 정해진
  // 간격/각도/크기로 배치된다. 카드 4장이 전부 화면에 남아있는 실제 카드
  // 뭉치처럼, 뒤로 갈수록 더 기울고 작아지며 앞 카드에 가려 잘려 보일 뿐
  // 완전히 사라지지는 않는다(opacity는 항상 1).
  const SPACING = 90;
  const ANGLE_STEP = 8;

  function layout() {
    const n = faces.length;
    cardEls.forEach((el, i) => {
      let rel = i - activeIndex;
      if (rel > n / 2) rel -= n;
      if (rel < -n / 2) rel += n;
      const depth = Math.abs(rel);
      const angle = rel * ANGLE_STEP;
      const x = rel * SPACING;
      const scale = Math.max(0.82, 1 - depth * 0.07);
      el.style.transform = `translate(-50%, -50%) translateX(${x}px) rotate(${angle}deg) scale(${scale})`;
      el.style.zIndex = String(n - depth);
      el.style.opacity = '1';
    });
  }
  layout();

  // activeIndex는 오직 손을 뗀(또는 스크롤이 멈춘) 이 시점에서만, 그것도 이
  // 함수가 호출될 때 딱 한 번만 바뀐다 — 드래그 도중에는 절대 바뀌지 않는다.
  // 아무리 길게 끌든 짧게 끌든 기준(30px)만 넘으면 옆 카드 한 장만 중앙으로 온다.
  const COMMIT_THRESHOLD = 30;

  // 드래그하는 동안 손가락 위치를 실시간으로 따라가지 않는다. 드래그는 그저
  // "방향이 있는 제스처"일 뿐이고, 그 제스처가 끝나면(손을 떼면) 카드는 얼마나
  // 끌었는지와 무관하게 항상 정해진 거리(카드 간격)만큼, 정해진 속도(CSS
  // 트랜지션 시간)로 움직인다.
  function commitDrag(dx) {
    if (Math.abs(dx) >= COMMIT_THRESHOLD) {
      const n = faces.length;
      activeIndex = dx < 0 ? (activeIndex + 1) % n : (activeIndex - 1 + n) % n;
    }
    layout();
  }

  // 터치와 마우스를 각각 따로 처리하면 한 번의 터치에 브라우저가 호환용으로
  // 뒤따라 발생시키는 마우스 이벤트까지 겹쳐 두 번 넘어가 버릴 수 있어서,
  // Pointer Events 하나로 통일해 이 문제 자체가 생기지 않게 한다. 드래그 도중
  // 다른 손가락이 실수로 닿아도 activePointerId로 걸러 원래 손가락의 제스처만
  // 인정한다. pointerup/cancel이 어떤 이유로든 누락되면 다음 드래그를 영원히
  // 못 잡게 될 수 있어서, 새 pointerdown이 오면 이전 상태는 그냥 덮어쓰고,
  // lostpointercapture도 안전망으로 같이 걸어 상태가 꼬여 있지 않게 한다.
  let activePointerId = null;
  let dragStartX = null;

  stack.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    activePointerId = e.pointerId;
    dragStartX = e.clientX;
    stack.setPointerCapture(e.pointerId);
  });
  function endPointerDrag(e) {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;
    if (dragStartX === null) return;
    const dx = e.clientX - dragStartX;
    dragStartX = null;
    commitDrag(dx);
  }
  function resetPointerDrag(e) {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;
    dragStartX = null;
  }
  stack.addEventListener('pointerup', endPointerDrag);
  stack.addEventListener('pointercancel', endPointerDrag);
  stack.addEventListener('lostpointercapture', resetPointerDrag);

  // 노트북 트랙패드 두 손가락 좌우 스와이프(wheel deltaX)도 지원한다. 트랙패드는
  // 손을 떼는 이벤트가 따로 없어서 "스크롤이 멈췄다"를 짧은 유휴 시간으로
  // 판단할 수밖에 없는데, 0ms는 이벤트 간격이 불규칙할 때 스크롤 도중을 멈춘
  // 것으로 잘못 판단하기 쉬워 80ms 정도로 안전하게 잡는다.
  let wheelVirtualX = 0;
  let wheelActive = false;
  let wheelIdleTimer = null;
  stack.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    if (!wheelActive) {
      wheelActive = true;
      wheelVirtualX = 0;
    }
    wheelVirtualX -= e.deltaX;
    clearTimeout(wheelIdleTimer);
    wheelIdleTimer = setTimeout(() => {
      wheelActive = false;
      commitDrag(wheelVirtualX);
    }, 80);
  }, { passive: false });

  // 양옆에 걸쳐 보이는 카드를 클릭(탭)하면 드래그 없이도 그 카드가 바로 중앙으로 온다.
  // setPointerCapture 때문에 click의 e.target이 실제로 클릭한 카드가 아니라
  // stack 자신으로 잡히므로, 클릭 좌표로 실제 화면에 그려진 카드를 다시 찾는다.
  stack.addEventListener('click', (e) => {
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const card = hit ? hit.closest('.hint-stack-card') : null;
    if (!card) return;
    const idx = cardEls.indexOf(card);
    if (idx === -1 || idx === activeIndex) return;
    activeIndex = idx;
    layout();
  });

  return stack;
}

// 카드(서류)가 있는 단계 화면이 열릴 때, 서류가 바로 보이는 대신 화면을
// 잠깐 어둡게 가리는 막 위에 헤딩+설명 문구를 띄웠다가 몇 초 뒤 스르륵
// 사라지게 한다. 문구가 사라지고 나면 서류 화면 자체에는 이 문구가 다시
// 나타나지 않는다 — 톤/명도/채도, 카드가 있는 모든 단계에 동일하게 적용된다.
const stageIntroVeil = document.createElement('div');
stageIntroVeil.className = 'stage-intro-veil';
const stageIntroVeilHeading = document.createElement('h3');
stageIntroVeilHeading.className = 'tutorial-heading';
const stageIntroVeilBody = document.createElement('p');
stageIntroVeilBody.className = 'tutorial-body';
stageIntroVeilBody.style.maxWidth = '480px';
stageIntroVeil.appendChild(stageIntroVeilHeading);
stageIntroVeil.appendChild(stageIntroVeilBody);
stageHintOverlay.appendChild(stageIntroVeil);

let stageIntroVeilTimer = null;
function showStageIntroVeil(heading, body) {
  clearTimeout(stageIntroVeilTimer);
  stageIntroVeilHeading.textContent = heading || '';
  stageIntroVeilBody.textContent = body || '';
  stageIntroVeilBody.style.display = body ? '' : 'none';
  stageIntroVeil.style.display = 'flex';
  stageIntroVeil.style.transition = 'none';
  stageIntroVeil.style.opacity = '1';
  // 막이 떠 있는 동안엔 뒤에 있는 서류가 비쳐 보이며 문구와 겹치지 않도록,
  // 서류도 함께 숨겨둔다.
  stageHintCards.style.transition = 'none';
  stageHintCards.style.opacity = '0';
  void stageIntroVeil.offsetWidth;
  stageIntroVeil.style.transition = 'opacity 0.8s ease';
  stageHintCards.style.transition = 'opacity 0.8s ease';
  stageIntroVeilTimer = setTimeout(() => {
    stageIntroVeil.style.opacity = '0';
    stageHintCards.style.opacity = '1';
    stageIntroVeilTimer = setTimeout(() => {
      stageIntroVeil.style.display = 'none';
    }, 800);
  }, 2500);
}

// 인트로 막이 떠 있는 동안 화면을 클릭하면, 다음 단계(색 선택 화면)로 바로
// 건너뛰지 않고 그 다음 페이지인 서류 화면만 앞당겨 보여준다. 막이 이미
// 사라진 상태였다면(=서류가 이미 보이는 중) false를 반환해 평소처럼
// confirmStageHint가 계속 진행되게 한다.
function skipStageIntroVeil() {
  if (stageIntroVeil.style.display === 'none') return false;
  clearTimeout(stageIntroVeilTimer);
  stageIntroVeil.style.transition = 'opacity 0.4s ease';
  stageIntroVeil.style.opacity = '0';
  stageHintCards.style.transition = 'opacity 0.4s ease';
  stageHintCards.style.opacity = '1';
  stageIntroVeilTimer = setTimeout(() => {
    stageIntroVeil.style.display = 'none';
  }, 400);
  return true;
}

function hideStageIntroVeil() {
  clearTimeout(stageIntroVeilTimer);
  stageIntroVeil.style.transition = 'none';
  stageIntroVeil.style.opacity = '0';
  stageIntroVeil.style.display = 'none';
  stageHintCards.style.transition = 'none';
  stageHintCards.style.opacity = '1';
}

function renderStageHintBody(hint) {
  stageHintCards.innerHTML = '';
  stageHintEnvelope.style.display = 'none';
  if (hint.cards) {
    // 서류 화면 자체에는 헤딩/설명 문구를 띄우지 않는다 — 위 인트로 막에서만 보여준다.
    stageHintHeading.style.display = 'none';
    stageHintBody.style.display = 'none';
    stageHintCards.style.display = 'flex';
    if (isLikelyMobile) {
      stageHintCards.appendChild(buildMobileCardStack(hint.cards));
    } else {
      stageHintCards.appendChild(buildHintDocument(hint.cards));
    }
    showStageIntroVeil(hint.heading, hint.summary);
  } else {
    hideStageIntroVeil();
    stageHintHeading.style.display = '';
    stageHintBody.textContent = hint.body || '';
    stageHintBody.style.display = '';
    stageHintCards.style.display = 'none';
  }
}

// 단계 6(최종 결과) 안내에서만 보여주는 봉투 그래픽. 카드/폼폼/스티커/팔찌가 이미
// 하나로 합성된 단일 이미지를 그대로 보여준다.
const stageHintEnvelope = document.createElement('div');
stageHintEnvelope.className = 'result-envelope';
stageHintEnvelope.style.display = 'none';
stageHintEnvelope.style.cursor = 'pointer';
// src는 여기서 바로 안 넣는다 — <img>는 src가 설정되는 순간 화면에 보이든 말든
// 즉시 네트워크로 받아오기 시작하는데, 이 봉투 이미지(1MB 가까이 됨)는 실제로
// 진단을 끝까지 마쳐야만 보이는 화면이라 첫 화면 로딩과는 아무 상관이 없다.
// 그래서 실제로 이 화면에 처음 도달하는 시점(아래 stageAdvanceButton의 종합
// 단계 분기)에 가서야 src를 지연 할당한다.
const stageHintEnvelopeImg = document.createElement('img');
stageHintEnvelopeImg.alt = '';
stageHintEnvelope.appendChild(stageHintEnvelopeImg);

// 봉투를 클릭하면(단계 6 결과 화면에서만) 편지가 삐져나온 확대 화면을 새로 띄운다.
// 배경을 다시 누르면 원래 흐름대로 뷰티팁 화면으로 넘어간다.
const letterRevealOverlay = document.createElement('div');
letterRevealOverlay.style.position = 'fixed';
letterRevealOverlay.style.inset = '0';
letterRevealOverlay.style.zIndex = '1600';
letterRevealOverlay.style.display = 'flex';
letterRevealOverlay.style.alignItems = 'center';
letterRevealOverlay.style.justifyContent = 'center';
letterRevealOverlay.style.padding = '24px';
letterRevealOverlay.style.opacity = '0';
letterRevealOverlay.style.pointerEvents = 'none';
letterRevealOverlay.style.transition = 'opacity 0.4s ease';
// 플랩/몸통을 따로 두어, 위치·크기를 css/gain.css의 .lr-flap/.lr-body 규칙에서
// 직접(%) 조절할 수 있게 한다. 편지지는 아래에서 별도로(드래그 가능한 lr-paper로) 만든다.
const letterRevealStage = document.createElement('div');
letterRevealStage.className = 'letter-reveal';
// 여기서도 src를 바로 안 넣는다 — 결제까지 끝내야 보이는 화면인데 이미지 두 장이
// 합쳐서 1MB가 넘어서, 첫 화면부터 미리 받아두면 로딩만 무거워질 뿐 아무 이득이
// 없다. 실제로 결제가 끝나 이 화면을 여는 시점(openLetterAfterPayment)에 지연 할당한다.
const LETTER_REVEAL_IMAGE_SOURCES = [
  ['lr-body', 'envelope-letter-body.png'],
  ['lr-flap', 'envelope-letter-flap.png'],
];
const letterRevealImages = LETTER_REVEAL_IMAGE_SOURCES.map(([cls]) => {
  const img = document.createElement('img');
  img.className = cls;
  img.alt = '';
  letterRevealStage.appendChild(img);
  return img;
});
function loadLetterRevealImagesOnce() {
  if (letterRevealImages[0].src) return; // 이미 한 번 로드했으면 다시 요청하지 않는다.
  letterRevealImages.forEach((img, i) => {
    img.src = LETTER_REVEAL_IMAGE_SOURCES[i][1];
  });
  letterPaper.style.backgroundImage = "url('envelope-letter-card.png')";
}

// lr-paper-anchor는 예전 lr-card와 똑같은 자리(화면 안, 다른 버튼과도 안 겹치는
// 자리)에 고정된 "기준점"일 뿐이고 overflow를 자르지 않는다. 그 안의 lr-paper(편지지
// 배경+텍스트)는 이 기준점의 top에 붙어서 아래로 자연스럽게 길게 늘어난다.
// 안 보이는 lr-scroll-capture(같은 자리, opacity:0)가 네이티브 스크롤로 입력만
// 받아서, 그 scrollTop 값을 lr-paper의 translateY로 그대로 옮긴다 — 그래서
// 스크롤하면 편지지 자체가 화면에서 실제로 위로 이동한다(잘리지 않고 계속 보임).
const letterPaperAnchor = document.createElement('div');
letterPaperAnchor.className = 'lr-paper-anchor';
const letterPaper = document.createElement('div');
letterPaper.className = 'lr-paper';
letterPaperAnchor.appendChild(letterPaper);

const letterCardText = document.createElement('div');
letterCardText.className = 'lr-text';
letterPaper.appendChild(letterCardText);

const letterScrollCapture = document.createElement('div');
letterScrollCapture.className = 'lr-scroll-capture no-scrollbar';
const letterScrollSpacer = document.createElement('div');
letterScrollSpacer.className = 'lr-scroll-spacer';
letterScrollCapture.appendChild(letterScrollSpacer);
letterPaperAnchor.appendChild(letterScrollCapture);

letterRevealStage.appendChild(letterPaperAnchor);

// 스크롤 제스처가 배경 클릭(다음 화면 넘기기)으로 오인되지 않도록 막는다.
// (편지지 안의 버튼이 이 레이어에 가려 안 눌리는 문제는, pointer-events를 껐다
// 켜서 클릭을 "전달"하는 트릭 대신 — 그 방식은 타이밍에 따라 불안정했다 — 아예
// .lr-palette-button의 z-index를 이 레이어보다 높여서 그 버튼 자리에서는 애초에
// 이 레이어가 클릭을 가로채지 못하게 만들었다. css/gain.css 참고.)
letterScrollCapture.addEventListener('click', (e) => {
  e.stopPropagation();
});

// 스크롤 값(목표 지점)을 그대로 즉시 옮기면 뚝뚝 끊기듯 순간이동해서 부자연스럽다.
// 매 프레임 목표까지 조금씩(15%) 따라가게 해서, 손을 뗀 뒤에도 살짝 더 움직이다
// 부드럽게 정착하는 "관성" 느낌을 준다.
let letterPaperTargetY = 0;
let letterPaperCurrentY = 0;
let letterPaperRafId = null;
function stepLetterPaperFollow() {
  const diff = letterPaperTargetY - letterPaperCurrentY;
  if (Math.abs(diff) < 0.5) {
    letterPaperCurrentY = letterPaperTargetY;
    letterPaper.style.transform = `translate3d(0, ${letterPaperCurrentY}px, 0)`;
    letterPaperRafId = null;
    return;
  }
  letterPaperCurrentY += diff * 0.18;
  letterPaper.style.transform = `translate3d(0, ${letterPaperCurrentY}px, 0)`;
  letterPaperRafId = requestAnimationFrame(stepLetterPaperFollow);
}
letterScrollCapture.addEventListener('scroll', () => {
  letterPaperTargetY = -letterScrollCapture.scrollTop;
  if (letterPaperRafId === null) {
    letterPaperRafId = requestAnimationFrame(stepLetterPaperFollow);
  }
});

function renderLetterCardText(seasonIndex) {
  letterCardText.innerHTML = '';
  const title = document.createElement('p');
  title.className = 'lr-text-title';
  title.textContent = `${SEASON16_GROUPS[seasonIndex].name} 타입`;
  letterCardText.appendChild(title);

  const tip = SEASON16_TIPS[seasonIndex];
  const addSection = (label, bodyText) => {
    const sec = document.createElement('div');
    sec.className = 'lr-text-section';
    const l = document.createElement('p');
    l.className = 'lr-text-label';
    l.textContent = label;
    const b = document.createElement('p');
    b.className = 'lr-text-body';
    b.textContent = bodyText;
    sec.appendChild(l);
    sec.appendChild(b);
    letterCardText.appendChild(sec);
  };

  addSection('의상', tip.outfit);

  const makeupSec = document.createElement('div');
  makeupSec.className = 'lr-text-section';
  const makeupLabel = document.createElement('p');
  makeupLabel.className = 'lr-text-label';
  makeupLabel.textContent = '메이크업';
  makeupSec.appendChild(makeupLabel);
  tip.makeup.forEach(([subLabel, text]) => {
    const item = document.createElement('p');
    item.className = 'lr-text-body';
    item.textContent = `${subLabel} — ${text}`;
    makeupSec.appendChild(item);
  });
  letterCardText.appendChild(makeupSec);

  addSection('헤어', tip.hair);
  addSection('주얼리', tip.jewelry);
  addSection('네일', tip.nail);
  currentLetterSeasonIndex = seasonIndex;
}

letterRevealOverlay.appendChild(letterRevealStage);
document.body.appendChild(letterRevealOverlay);

// 편지 화면 우측 상단의 "End" 버튼. 뷰티팁 화면(메이크업/헤어/주얼리/네일)으로
// 더 이상 넘어가지 않고, 여기서 바로 홈(첫 화면)으로 나간다. 홈으로 돌아가는
// 로직은 기존 endButton과 완전히 동일해야 하므로, 그 버튼을 그대로 눌러
// 재사용한다(로직 중복 없이).
const letterEndButton = document.createElement('button');
letterEndButton.className = 'lr-end-button';
letterEndButton.textContent = 'End';
letterEndButton.setAttribute('aria-label', '종료하고 처음 화면으로');
letterEndButton.addEventListener('click', (e) => {
  e.stopPropagation();
  letterRevealOverlay.style.opacity = '0';
  letterRevealOverlay.style.pointerEvents = 'none';
  // endButton의 로직은 뷰티팁 화면 전용이라 6단계/편지 관련 요소(색 구름 배경,
  // 봉투 등)는 안 지워진다. 진짜로 첫 화면까지 완전히 되돌리는 hideColorOverlay를
  // 대신 쓴다.
  stageHintEnvelope.style.display = 'none';
  hideColorOverlay();
});
letterRevealOverlay.appendChild(letterEndButton);

// "컬러 팔레트 보기" 버튼. 편지지 안(스크롤되는 영역)에 넣으면 그 위를 덮는
// lr-scroll-capture 레이어(스크롤 입력을 받는 투명 레이어)와 쌓임 순서가 계속
// 꼬여서(특히 lr-paper의 will-change:transform이 새 쌓임 맥락을 만들어 버튼의
// z-index를 아무리 올려도 이길 수 없었다) 클릭이 안 먹는 문제가 반복됐다.
// 그래서 스크롤 레이어와 아예 겹치지 않는, 화면에 고정된 버튼으로 둔다 —
// 편지지와 함께 움직이진 않지만 항상 확실하게 눌린다.
let currentLetterSeasonIndex = null;
const letterPaletteButton = document.createElement('button');
letterPaletteButton.className = 'lr-palette-button';
letterPaletteButton.textContent = '컬러 팔레트 보기';
letterPaletteButton.addEventListener('click', (e) => {
  e.stopPropagation();
  if (currentLetterSeasonIndex === null) return;
  enterSeasonPaletteFromLetter(currentLetterSeasonIndex);
});
letterRevealOverlay.appendChild(letterPaletteButton);

// "컬러 팔레트 보기"는 새 화면을 그리지 않고, 앱에 이미 있는 색 선택 단계의
// "확정한 색 보기" 화면(colorOverlay 전체 배경 + paletteBar 3D 스와치 캐러셀 +
// paletteToneTabs의 Grayish/Muted/High Chroma 탭 + backButton)을 그대로
// 재사용한다. 그 화면은 confirmedColors(사용자가 진단 중 직접 확정한 색)를
// 보여주는 용도라서, 이번 시즌 컬러를 보여주는 동안만 confirmedColors 내용을
// 잠깐 이 시즌 색으로 바꿔치기했다가, 나갈 때 원래 값으로 정확히 되돌린다.
let letterPaletteReturnActive = false;
let letterPaletteSavedConfirmedColors = null;
let letterPaletteSavedPracticeStage = null;
let letterPaletteSavedPaletteMode = null;
let letterPaletteSavedColor = null;
let letterPaletteSavedIsPracticeMode = false;

function enterSeasonPaletteFromLetter(seasonIndex) {
  if (letterPaletteReturnActive) return;
  letterPaletteReturnActive = true;

  letterPaletteSavedConfirmedColors = confirmedColors.slice();
  letterPaletteSavedPracticeStage = practiceStage;
  letterPaletteSavedPaletteMode = currentPaletteMode;
  letterPaletteSavedColor = currentColor;
  letterPaletteSavedIsPracticeMode = isPracticeMode;

  confirmedColors.length = 0;
  confirmedColors.push(...SEASON16_GROUPS[seasonIndex].colors);
  // isPracticeMode가 켜져 있으면 "표시된 색 = 이미 확정된 색"으로 취급돼, 방금
  // confirmedColors에 넣은 이 시즌 색 전부가 확정 표시(체크/원형 마스크)로
  // 보인다. 이 화면은 그냥 둘러보는 용도라 표시가 필요 없으니 꺼둔다.
  isPracticeMode = false;

  // "Grayish/Muted/High Chroma" 탭이 뜨는 건 chroma 단계 탭 구성이라, 그 구성으로
  // 맞춰서 다시 그린다.
  practiceStage = 'chroma';
  renderStageTabs();

  letterRevealOverlay.style.opacity = '0';
  letterRevealOverlay.style.pointerEvents = 'none';
  // synthesisBackdrop(색 구름, z-index 1000)이 colorOverlay(단색 배경, z-index 999)
  // 보다 위에 있어서 꺼두지 않으면 단색 대신 색 구름이 계속 비쳐 보인다.
  synthesisBackdrop.style.opacity = '0';
  synthesisBackdrop.style.pointerEvents = 'none';

  colorOverlay.style.transitionDuration = '0s';
  colorOverlay.style.clipPath = 'circle(150% at 50% 50%)';
  colorOverlay.style.pointerEvents = 'auto';

  setPaletteMode('confirmed');

  backButton.style.opacity = '1';
  backButton.style.pointerEvents = 'auto';
  paletteBar.style.opacity = '1';
  paletteBar.style.pointerEvents = 'auto';
  // 톤 탭(Grayish/Muted/High Chroma) 글자는 이 화면에서는 안 보이게 둔다.
  paletteToneTabs.style.opacity = '0';
  paletteToneTabs.style.pointerEvents = 'none';
  paletteCenterShadow.style.opacity = '1';
  paletteExpandArrow.style.opacity = '1';
  paletteExpandArrow.style.pointerEvents = 'auto';
}

// backButton의 클릭 핸들러(이 파일 뒤쪽에 정의됨)가 letterPaletteReturnActive를
// 확인해서 이 함수를 호출한다 — confirmedColors 등을 정확히 원래대로 되돌리고
// 편지 화면으로 돌아간다.
function exitSeasonPaletteToLetter() {
  letterPaletteReturnActive = false;

  confirmedColors.length = 0;
  confirmedColors.push(...letterPaletteSavedConfirmedColors);
  practiceStage = letterPaletteSavedPracticeStage;
  currentPaletteMode = letterPaletteSavedPaletteMode;
  currentColor = letterPaletteSavedColor;
  isPracticeMode = letterPaletteSavedIsPracticeMode;

  colorOverlay.style.pointerEvents = 'none';
  backButton.style.opacity = '0';
  backButton.style.pointerEvents = 'none';
  paletteBar.style.opacity = '0';
  paletteBar.style.pointerEvents = 'none';
  paletteToneTabs.style.opacity = '0';
  paletteToneTabs.style.pointerEvents = 'none';
  paletteCenterShadow.style.opacity = '0';
  paletteExpandArrow.style.opacity = '0';
  paletteExpandArrow.style.pointerEvents = 'none';

  // 편지 화면의 배경이던 색 구름을 되살린다.
  synthesisBackdrop.style.opacity = '1';
  synthesisBackdrop.style.pointerEvents = 'none';

  letterRevealOverlay.style.opacity = '1';
  letterRevealOverlay.style.pointerEvents = 'auto';
}

// 편지 화면으로 넘어가는 순간 화면 전체가 하얗게 번쩍였다가 사라지며, 그 아래
// 열린 편지 화면이 드러나게 하는 흰색 플래시.
const letterRevealFlash = document.createElement('div');
letterRevealFlash.style.position = 'fixed';
letterRevealFlash.style.inset = '0';
letterRevealFlash.style.zIndex = '1700';
letterRevealFlash.style.background = '#fff';
letterRevealFlash.style.opacity = '0';
letterRevealFlash.style.pointerEvents = 'none';
document.body.appendChild(letterRevealFlash);

// ---- 결제 화면 ----
// 봉투를 눌러도 편지를 바로 열지 않고, 먼저 결제창을 띄운다. 결제가 서버에서
// 검증된 뒤에만(아래 openLetterAfterPayment) 편지 화면으로 넘어간다.
// TODO: 아래 두 값은 포트원(PortOne) 대시보드에서 발급받은 실제 storeId/channelKey로
// 교체해야 결제창이 정상적으로 뜬다(테스트 연동 값도 이 자리에 넣으면 된다).
// 검증은 절대 프론트에서 끝내지 않는다 — netlify/functions/verify-payment.js가
// 포트원 서버에 실제 결제 상태/금액을 재확인한 뒤에만 편지를 연다.
const PORTONE_STORE_ID = 'REPLACE_WITH_PORTONE_STORE_ID';
const PORTONE_CHANNEL_KEY = 'REPLACE_WITH_PORTONE_CHANNEL_KEY';
const PAYMENT_AMOUNT = 1000;
const PAYMENT_ORDER_NAME = '퍼스널 RGB 진단 결과지';

const paymentOverlay = document.createElement('div');
paymentOverlay.className = 'payment-overlay';

const paymentCard = document.createElement('div');
paymentCard.className = 'payment-card';

const paymentTitle = document.createElement('p');
paymentTitle.className = 'payment-title';
paymentTitle.textContent = PAYMENT_ORDER_NAME;

// 결과지 안에 실제로 뭐가 들어있는지(편지 화면의 renderLetterCardText가
// 만드는 카테고리와 동일) 결제 전에 미리 보여준다.
const paymentDescription = document.createElement('p');
paymentDescription.className = 'payment-description';
paymentDescription.textContent = '의상 · 메이크업 · 헤어 · 주얼리 · 네일, 5가지 카테고리로 완성되는 나만의 컬러 가이드를 편지로 받아보세요.';

const paymentPayButton = document.createElement('button');
paymentPayButton.type = 'button';
paymentPayButton.className = 'payment-pay-button';
paymentPayButton.textContent = `${PAYMENT_AMOUNT.toLocaleString()}원 결제하기`;

const paymentError = document.createElement('p');
paymentError.className = 'payment-error';

// 결제 카드 좌측 상단 안쪽에 놓는 Back 버튼(카드 기준 절대 위치).
const paymentBackButton = document.createElement('button');
paymentBackButton.type = 'button';
paymentBackButton.className = 'payment-back-button';
paymentBackButton.textContent = '← Back';
paymentBackButton.style.position = 'absolute';
paymentBackButton.style.top = '14px';
paymentBackButton.style.left = '16px';
paymentBackButton.style.zIndex = '2';
paymentBackButton.style.background = 'transparent';
paymentBackButton.style.border = 'none';
paymentBackButton.style.color = '#999999';
paymentBackButton.style.padding = '4px 6px';
paymentBackButton.style.fontSize = '12px';
paymentBackButton.style.fontWeight = '300';
paymentBackButton.style.cursor = 'pointer';

paymentCard.appendChild(paymentBackButton);
paymentCard.appendChild(paymentTitle);
paymentCard.appendChild(paymentDescription);
paymentCard.appendChild(paymentPayButton);
paymentCard.appendChild(paymentError);
paymentOverlay.appendChild(paymentCard);
document.body.appendChild(paymentOverlay);

function showPaymentScreen() {
  paymentError.style.display = 'none';
  paymentPayButton.disabled = false;
  paymentPayButton.textContent = `${PAYMENT_AMOUNT.toLocaleString()}원 결제하기`;
  paymentOverlay.style.opacity = '1';
  paymentOverlay.style.pointerEvents = 'auto';
}

function hidePaymentScreen() {
  paymentOverlay.style.opacity = '0';
  paymentOverlay.style.pointerEvents = 'none';
}

// 결제하지 않고(Back/배경 클릭) 닫을 때 쓴다. 홈에서 미리보기용으로 빌려 쓴
// pendingFinalSeason=0을 원래 상태(null)로 되돌려, 이후 실제 진단 플로우를
// 막지 않게 한다.
function closePaymentWithoutPaying() {
  hidePaymentScreen();
  if (paymentOpenedFromHome) {
    pendingFinalSeason = null;
    paymentOpenedFromHome = false;
  }
}

paymentBackButton.addEventListener('click', (e) => {
  e.stopPropagation();
  closePaymentWithoutPaying();
});

// 카드 바깥(어두운 배경)을 눌러도 닫히게 한다.
paymentOverlay.addEventListener('click', (e) => {
  if (e.target === paymentOverlay) closePaymentWithoutPaying();
});

async function verifyPaymentOnServer(paymentId) {
  const res = await fetch('/.netlify/functions/verify-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentId }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return !!data.ok;
}

paymentPayButton.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (typeof PortOne === 'undefined') {
    paymentError.textContent = '결제 모듈을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
    paymentError.style.display = 'block';
    return;
  }
  paymentError.style.display = 'none';
  paymentPayButton.disabled = true;
  paymentPayButton.textContent = '결제 진행 중...';
  const paymentId = `personalrgb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const response = await PortOne.requestPayment({
      storeId: PORTONE_STORE_ID,
      channelKey: PORTONE_CHANNEL_KEY,
      paymentId,
      orderName: PAYMENT_ORDER_NAME,
      totalAmount: PAYMENT_AMOUNT,
      currency: 'CURRENCY_KRW',
      payMethod: 'CARD',
    });
    if (response.code) {
      paymentError.textContent = response.message || '결제가 취소되었습니다.';
      paymentError.style.display = 'block';
      return;
    }
    const verified = await verifyPaymentOnServer(response.paymentId || paymentId);
    if (!verified) {
      paymentError.textContent = '결제 확인에 실패했습니다. 다시 시도해주세요.';
      paymentError.style.display = 'block';
      return;
    }
    hidePaymentScreen();
    // 홈 화면의 "결제하기"는 pendingFinalSeason을 미리보기용(봄 페일=0)으로
    // 미리 채워두므로, 실제 진단 여부와 무관하게 여기서 항상 편지를 연다.
    paymentOpenedFromHome = false;
    if (pendingFinalSeason !== null) {
      openLetterAfterPayment();
    }
  } catch (err) {
    paymentError.textContent = '결제 중 오류가 발생했습니다.';
    paymentError.style.display = 'block';
  } finally {
    paymentPayButton.disabled = false;
    paymentPayButton.textContent = `${PAYMENT_AMOUNT.toLocaleString()}원 결제하기`;
  }
});

stageHintEnvelope.addEventListener('click', (e) => {
  if (pendingFinalSeason === null) return;
  e.stopPropagation();
  paymentOpenedFromHome = false;
  showPaymentScreen();
});

// 결제가 서버에서 검증된 뒤에만 호출된다 — 편지가 삐져나온 확대 화면을 연다.
function openLetterAfterPayment() {
  loadLetterRevealImagesOnce();
  stageHintOverlay.style.opacity = '0';
  stageHintOverlay.style.pointerEvents = 'none';
  // letterRevealOverlay는 배경이 투명해서(색 구름이 비쳐 보이게), 종합 단계에
  // 남아있던 "Select"/"← Back"/Warm·Cool 탭/상단 계절 탭 같은 UI가 안 가려지고
  // 그대로 겹쳐 보였다. 편지 화면을 여는 동안은 확실히 꺼둔다.
  // 홈 화면의 "결제하기" 지름길로 들어온 경우 튜토리얼 아이콘/결제하기 버튼이
  // 아직 화면에 떠 있는 상태라(정상 진단 경로에서는 이미 홈을 벗어날 때 숨겨짐),
  // 여기서도 명시적으로 같이 꺼서 End 버튼과 겹치지 않게 한다.
  setHomeIconsOpacity('0');
  stageAdvanceButton.style.opacity = '0';
  stageAdvanceButton.style.pointerEvents = 'none';
  backButton.style.opacity = '0';
  backButton.style.pointerEvents = 'none';
  paletteToneTabs.style.opacity = '0';
  paletteToneTabs.style.pointerEvents = 'none';
  toneButtonsEl.style.opacity = '0';
  toneButtonsEl.style.pointerEvents = 'none';
  // 단계 5(종합)에서 보여줬던, 여러 계열의 색이 떠다니는 색 구름 배경(synthesisBackdrop)을
  // 그대로 재사용한다. 결과로 나온 시즌 기준으로 다시 그려서 뒤에 깔아준다.
  renderSynthesisBackdrop(pendingFinalSeason);
  synthesisBackdrop.style.opacity = '1';
  synthesisBackdrop.style.pointerEvents = 'none';
  renderLetterCardText(pendingFinalSeason);
  if (letterPaperRafId !== null) {
    cancelAnimationFrame(letterPaperRafId);
    letterPaperRafId = null;
  }
  requestAnimationFrame(() => {
    // 스크롤 범위를 "텍스트 끝난 지점 + 약간의 여유"까지만 만든다. 텍스트 전체
    // 길이만큼 다 올릴 수 있게 하면(예전 방식) 다 읽고 난 뒤에도 빈 여백이 한참
    // 더 스크롤돼서, 끝에 다다르면 더 안 올라가고 딱 걸리는 느낌이 나게 한다.
    const contentHeight = letterPaper.scrollHeight;
    const captureHeight = letterScrollCapture.clientHeight;
    // 편지지가 봉투에서 붕 떠 보이지 않도록 여유 없이 딱 마지막 줄까지만 올라간다.
    const extraRise = -10;
    const maxScroll = Math.max(0, contentHeight - captureHeight) + extraRise;
    letterScrollSpacer.style.height = `${captureHeight + maxScroll}px`;

    // 처음 열릴 때부터 편지지를 살짝 들어올린 위치에서 시작한다. 모바일은 화면이
    // 좁아 봉투에 더 많이 가려 보이므로 데스크탑보다 조금 더 높이 들어올린다.
    const initialRise = contentHeight * (isLikelyMobile ? 0.15 : 0.08);
    if (letterPaperRafId !== null) {
      cancelAnimationFrame(letterPaperRafId);
      letterPaperRafId = null;
    }
    letterPaperTargetY = -initialRise;
    letterPaperCurrentY = -initialRise;
    letterPaper.style.transform = `translate3d(0, ${-initialRise}px, 0)`;
    letterScrollCapture.scrollTop = initialRise;
  });
  letterRevealOverlay.style.opacity = '1';
  letterRevealOverlay.style.pointerEvents = 'auto';

  // 화면을 즉시 하얗게 채운 뒤, 트랜지션을 다시 붙여 서서히(2.2s) 걷어낸다.
  letterRevealFlash.style.transition = 'none';
  letterRevealFlash.style.opacity = '1';
  void letterRevealFlash.offsetWidth;
  letterRevealFlash.style.transition = 'opacity 2.2s ease';
  requestAnimationFrame(() => {
    letterRevealFlash.style.opacity = '0';
  });
}

stageHintContent.appendChild(stageHintHeading);
stageHintContent.appendChild(stageHintBody);
stageHintContent.appendChild(stageHintCards);
stageHintContent.appendChild(stageHintEnvelope);
stageHintOverlay.appendChild(stageHintContent);

// 가운데 정렬된 카드 묶음과 별개로, 단계 설명("단계 N · O차 드레이핑")은 화면 맨 아래로
// 따로 떨어뜨려 고정한다.
stageHintEyebrow.style.position = 'absolute';
stageHintEyebrow.style.left = '50%';
stageHintEyebrow.style.bottom = 'calc(28px + env(safe-area-inset-bottom))';
stageHintEyebrow.style.transform = 'translateX(-50%)';
stageHintOverlay.appendChild(stageHintEyebrow);

// 튜토리얼 화면과 동일한 스타일·위치의 Back/Next 버튼. Back은 쌓아둔 이전 화면
// (stageNavStack)으로 하나씩 되돌아가고, 스택이 비어 있으면(맨 처음 안내) 튜토리얼로
// 돌아간다. Next는 배경을 눌렀을 때와 똑같이 다음 화면으로 확정 진행한다.
const stageHintBackButton = document.createElement('button');
stageHintBackButton.className = 'tutorial-back';
stageHintBackButton.textContent = '← Back';
stageHintBackButton.setAttribute('aria-label', '이전 화면으로');
stageHintBackButton.addEventListener('click', (e) => {
  e.stopPropagation();
  pendingStageIntro = null;
  pendingFinalSeason = null;
  stageHintOverlay.style.opacity = '0';
  stageHintOverlay.style.pointerEvents = 'none';
  if (stageNavStack.length > 0) {
    goStageNavEntry(stageNavStack.pop());
  } else {
    // 스택이 비어 있다면(튜토리얼 직후 첫 안내) 튜토리얼로 돌아간다. 이때 색 화면
    // (원 배경·팔레트 바·뒤로가기 등)이 그대로 남아있으면 반투명한 튜토리얼 배경
    // 뒤로 비쳐 보이므로, hideColorOverlay로 색 화면 자체를 완전히 걷어낸 뒤 연다.
    pendingPracticeEntryPoint = null;
    hideColorOverlay();
    tutorialIndex = tutorialSlides.length - 1;
    renderTutorialSlide();
    tutorialOverlay.classList.add('active');
    setHomeIconsOpacity('0');
  }
});
stageHintOverlay.appendChild(stageHintBackButton);

const stageHintNextButton = document.createElement('button');
stageHintNextButton.className = 'tutorial-next';
stageHintNextButton.textContent = 'Next →';
stageHintNextButton.setAttribute('aria-label', '다음 화면으로');
stageHintNextButton.addEventListener('click', (e) => {
  e.stopPropagation();
  confirmStageHint();
});
stageHintOverlay.appendChild(stageHintNextButton);

document.body.appendChild(stageHintOverlay);

stageAdvanceButton.addEventListener('click', (e) => {
  e.stopPropagation();
  if (pendingStageIntro || pendingFinalSeason !== null) return;

  // 종합 단계에서는 다음 단계로 넘어가는 대신, 지금까지 확정한 색의 비중을 분석해
  // 결과 문구를 보여준다.
  if (practiceStage === 'synthesis') {
    const seasonIndex = computeDominantSeason16();
    pendingFinalSeason = seasonIndex;
    pushStageNav({ type: 'color', stage: 'synthesis' });
    stageHintEyebrow.textContent = '';
    stageHintHeading.textContent = '';
    renderStageHintBody({
      body: `오늘 찾은 당신의 컬러, 한 통의 편지로 간직하세요.`

    });
    stageHintNextButton.style.display = 'none';
    if (!stageHintEnvelopeImg.src) stageHintEnvelopeImg.src = 'envelope.png';
    stageHintEnvelope.style.display = 'block';
    // 재진입 시에도 매번 다시 재생되도록, 애니메이션 클래스를 뗐다가(리플로우로
    // 강제 리셋) 다시 붙인다.
    stageHintEnvelope.classList.remove('envelope-enter');
    void stageHintEnvelope.offsetWidth;
    stageHintEnvelope.classList.add('envelope-enter');
    stageHintOverlay.style.opacity = '1';
    stageHintOverlay.style.pointerEvents = 'auto';
    return;
  }

  const nextStage = STAGE_ORDER[(STAGE_ORDER.indexOf(practiceStage) + 1) % STAGE_ORDER.length];
  pushStageNav({ type: 'color', stage: practiceStage });
  showStageHintScreen(nextStage);
});

// 안내 문구가 떠 있을 때 확정하고 다음 화면으로 넘어간다. 배경을 눌러도, Next 버튼을
// 눌러도 똑같이 이 함수가 실행된다.
function confirmStageHint() {
  // 봉투가 떠 있는 동안(pendingFinalSeason가 설정된 상태)에는 배경 클릭 등
  // 다른 경로로는 아무 것도 하지 않는다 — 봉투를 직접 눌러야만 결제 화면으로 넘어간다.
  if (pendingFinalSeason !== null) return;

  // 인트로 막이 아직 떠 있는 상태였다면, 색 선택 화면으로 건너뛰지 않고
  // 막만 먼저 걷어서 서류 화면을 보여준다.
  if (skipStageIntroVeil()) return;

  if (!pendingStageIntro) return;
  const stage = pendingStageIntro;
  pendingStageIntro = null;
  stageHintOverlay.style.opacity = '0';
  stageHintOverlay.style.pointerEvents = 'none';

  pushStageNav({ type: 'hint', stage });

  // 튜토리얼 직후 첫 단계(언더톤) 안내였다면, 여기서 처음으로 색 화면을 열어준다.
  if (pendingPracticeEntryPoint) {
    pendingPracticeEntryPoint = null;
    showColorOverlayFade(getFrontCardColor());
    paletteToneTabs.style.opacity = '1';
    paletteToneTabs.style.pointerEvents = 'auto';
  }

  showStageColorScreen(stage);
}
// 모바일에서는 실수로 스크롤/스와이프하다 잘못 넘어가는 걸 막기 위해 배경(또는
// 카드)을 탭해도 넘어가지 않고 Next 버튼으로만 이동한다. 데스크탑은 Back
// 버튼·카드(둘 다 자기 핸들러에서 stopPropagation으로 걸러짐) 이외에 배경 어디를
// 클릭해도 다음 화면으로 넘어간다(튜토리얼 화면과 동일한 규칙).
stageHintOverlay.addEventListener('click', () => {
  if (isLikelyMobile) return;
  confirmStageHint();
});

// 아이콘 뒤에 깔리는 발광 원. box-shadow 대신 실제 blur된 원 엘리먼트를 써서 각지거나
// 이상한 모양 없이 항상 매끈한 원으로 퍼지게 한다. 버튼의 첫 자식으로 넣어 아이콘(SVG)보다
// 뒤에(DOM 순서상 먼저) 깔리게 한다.
const paletteIconGlow = document.createElement('div');
paletteIconGlow.className = 'icon-glow';
paletteIconGlow.style.top = '50%';
paletteIconGlow.style.left = '50%';
paletteViewButton.insertBefore(paletteIconGlow, paletteViewButton.firstChild);

function updatePaletteViewButtonContrast(color) {
  const { l } = hexToHSL(color);
  const textColor = l < 50 ? '#ffffff' : '#111111';
  paletteViewButton.style.color = textColor;
  stageAdvanceButton.style.color = textColor;
  // 발광은 배경 명암과 상관없이 항상 밝은(흰색) 빛으로 보이게 한다.
  paletteViewButton.style.setProperty('--glow-color', 'rgba(255, 255, 255, 0.4)');
}

// 팔레트 아이콘을 누른 자리에서 빛이 확 퍼지듯 커지며 투명해지는 전환 효과.
// 화면이 바뀌는 순간을 이 빛 뒤에 숨겨뒀다가, 빛이 커지고 옅어지면서 자연스럽게
// 다음 화면이 드러나 보이게 한다.
const paletteTransitionGlow = document.createElement('div');
paletteTransitionGlow.className = 'palette-transition-glow';
document.body.appendChild(paletteTransitionGlow);

function burstPaletteTransitionGlow(x, y) {
  paletteTransitionGlow.style.left = `${x}px`;
  paletteTransitionGlow.style.top = `${y}px`;
  paletteTransitionGlow.classList.remove('burst');
  void paletteTransitionGlow.offsetWidth; // 강제 리플로우로 애니메이션을 처음부터 재생시킨다.
  paletteTransitionGlow.classList.add('burst');
}

// 팔레트(확정 색) 아이콘을 누르면 작은 목록 대신, 지금과 같은 전체화면 방식으로
// 확정해둔 색들만 코브플로우에 띄워 그대로 둘러볼 수 있게 한다. 들어가기 직전
// 상태를 기억해뒀다가 뒤로가기를 누르면 화면을 나가지 않고 그 상태로 돌아간다.
paletteViewButton.addEventListener('click', (e) => {
  e.stopPropagation();
  if (confirmedColors.length === 0 || currentPaletteMode.startsWith('confirmed')) return;

  // 팔레트 아이콘을 눌러 확정한 색 화면으로 들어가니, 진행 중이던 안내 힌트
  // 체인은 여기서도 멈춘다.
  hidePaletteDragHint();
  hideColorHint();

  const rect = paletteViewButton.getBoundingClientRect();
  burstPaletteTransitionGlow(rect.left + rect.width / 2, rect.top + rect.height / 2);

  previousPaletteMode = currentPaletteMode;
  previousPaletteColor = currentColor;
  setPaletteMode('confirmed');
  // 확정한 색 화면 안에서는 들어가는 입구(아이콘)는 숨기고, 그 자리에
  // 다음 단계로 넘어가는 텍스트만 하나 보여준다. 이 화면에서는 "Select"보다
  // 실제로 하는 일(다음 단계로 넘어가기)을 그대로 알려주는 게 더 명확하다.
  paletteViewButton.style.opacity = '0';
  paletteViewButton.style.pointerEvents = 'none';
  stageAdvanceButton.textContent = 'Next Step';
  stageAdvanceButton.style.opacity = '1';
  stageAdvanceButton.style.pointerEvents = 'auto';
});

// 팔레트 아이콘을 눌러 "확정한 색" 화면으로 들어오기 전의 모드/색/단계로 되돌린다.
function restorePreviousPaletteView() {
  const mode = previousPaletteMode || 'warm';
  const color = previousPaletteColor || currentColor;

  practiceStage = mode.startsWith('value') ? 'value' : mode.startsWith('chroma') ? 'chroma' : 'tone';
  renderStageTabs();

  currentColor = color;
  colorOverlay.style.background = color;
  updateBackButtonContrast(color);
  updatePaletteShadowColor(color);
  updateToneTabsContrast(color);
  updatePaletteViewButtonContrast(color);

  if (mode === 'family') {
    renderPalette(color);
  } else {
    currentPaletteMode = mode;
    renderPaletteFromList(paletteListForMode(mode, color), color);
    updateToneTabsActive();
  }

  // 확정 화면을 나와 다시 웜/쿨(또는 명도) 탐색 화면이니, "선택" 대신 팔레트 아이콘을 보여준다.
  paletteViewButton.style.opacity = '1';
  paletteViewButton.style.pointerEvents = 'auto';
  stageAdvanceButton.textContent = 'Select';
  stageAdvanceButton.style.opacity = '0';
  stageAdvanceButton.style.pointerEvents = 'none';
  previousPaletteMode = null;
  previousPaletteColor = null;
  closePaletteGrid();
}

// 팔레트에서 색을 확정할 때마다 아이콘이 벨이 울리듯 짧게 흔들리는 모션.
function bouncePaletteIconIcon() {
  paletteViewButton.classList.remove('bell');
  paletteIconGlow.classList.remove('pulse');
  void paletteViewButton.offsetWidth; // 강제 리플로우로 애니메이션을 처음부터 재생시킨다.
  paletteViewButton.classList.add('bell');
  paletteIconGlow.classList.add('pulse');
}

// 이미 중앙에 와 선명해진 체크 표시를 한 번 더 선택하면 그 색을 확정한다: 체크 구멍이
// 원형으로 바뀌고, 팔레트 아이콘이 흔들린다. 원형(확정) 상태에서 다시 선택하면
// 확정을 취소하고 체크 상태로 되돌린다.
function confirmSwatchColor(color, swatchEl) {
  const existingIndex = confirmedColors.findIndex((c) => c.toLowerCase() === color.toLowerCase());
  if (existingIndex >= 0) {
    confirmedColors.splice(existingIndex, 1);
  } else {
    confirmedColors.push(color);
  }
  bouncePaletteIconIcon();
  // 지금 이 화면이 "확정한 색" 계열 모드(전체/웜/쿨 필터)라면, 목록이 바뀐 즉시
  // 같은 모드로 코브플로우를 새로고침한다(단, 걸러진 목록이 비면 웜톤으로 돌아간다).
  if (currentPaletteMode.startsWith('confirmed')) {
    const stillHasColors = paletteListForMode(currentPaletteMode, color).length > 0;
    setPaletteMode(stillHasColors ? currentPaletteMode : 'warm');
  }
  updateSwatchCheckMask(swatchEl, color);
  // 지금 이 함수는 항상 "중앙에 와 있는" 스와치에서만 불리므로, 체크든 원형이든
  // 마개는 계속 걷어둔 채로 둔다.
  if (swatchEl.plugEl) swatchEl.plugEl.style.opacity = '0';
}

function openPaletteGrid() {
  isPaletteGridOpen = true;
  // 팔레트(그리드)에 들어왔으니 진행 중이던 안내 힌트 체인은 여기서 멈춘다.
  hidePaletteDragHint();
  hideColorHint();
  const { rows } = computePaletteGridDims();
  // 코브플로우 양 끝을 가리던 마스크를 없애야 펼쳐진 그리드 전체가 잘리지 않고 보인다.
  paletteBar.style.maskImage = 'none';
  paletteBar.style.webkitMaskImage = 'none';
  paletteExpandArrow.style.bottom = `${124 + (rows - 1) * PALETTE_GRID_SLOT}px`;
  paletteExpandArrow.style.transform = 'translateX(-50%) rotate(180deg)';
  applyPaletteLayout();
}

function closePaletteGrid() {
  isPaletteGridOpen = false;
  paletteBar.style.maskImage = 'linear-gradient(to right, transparent 0%, black 30%, black 70%, transparent 100%)';
  paletteBar.style.webkitMaskImage = paletteBar.style.maskImage;
  paletteExpandArrow.style.bottom = '124px';
  paletteExpandArrow.style.transform = 'translateX(-50%) rotate(0deg)';
  applyPaletteLayout();
}

paletteExpandArrow.addEventListener('click', (e) => {
  e.stopPropagation();
  if (isPaletteGridOpen) closePaletteGrid();
  else openPaletteGrid();
});

// 배경색 명도에 따라 뒤로가기 버튼 글씨를 자연스럽게 흰색/검정으로 바꾼다.
function updateBackButtonContrast(color) {
  const { l } = hexToHSL(color);
  backButton.style.color = l < 50 ? '#ffffff' : '#111111';
}

// 팔레트 중앙 그림자를 무채색 검정이 아니라, 배경색의 명도를 살짝 낮추고
// 채도를 높인 "그 색의 짙은 버전"으로 만든다.
// 텍스트/아이콘이 어두운 배경 위에서 흰색으로 뒤집히는 것과 같은 기준(l < 50)으로,
// 배경이 밝으면 그림자를 어둡게, 이미 어두우면 오히려 밝게 틀어서 항상 보이게 한다.
function paletteShadowHexFor(hex) {
  const { h, s, l } = hexToHSL(hex);
  // screen 블렌드는 흰색에 가까울수록 밝혀 보이는 힘이 세지므로, 어두운 배경에서는
  // (multiply의 "-22"처럼 살짝만 옮기지 않고) 확실히 밝은 값으로 크게 끌어올린다.
  const shiftedL = l < 50 ? 78 : Math.max(0, l - 22);
  return hslToHex(h, Math.min(100, s + 25), shiftedL);
}

function updatePaletteShadowColor(color) {
  const shadowHex = paletteShadowHexFor(color);
  paletteCenterShadow.style.background = hexToRgba(shadowHex, 0.2);
  // 중앙 스와치를 강조할 때 쓴 것과 동일한 그림자 색으로 화살표 자체를 채우되, 더 투명하게.
  paletteExpandArrowFill.style.background = hexToRgba(shadowHex, 0.3);
  // multiply는 항상 배경을 어둡게만 만들어서, 그림자 색을 밝게 틀어봤자 어두운 배경
  // 위에서는 그대로 묻혀버린다. 배경이 어두울 때는 밝혀 보이게 screen으로 바꾼다.
  const { l } = hexToHSL(color);
  paletteCenterShadow.style.mixBlendMode = l < 50 ? 'screen' : 'multiply';
}

function changeOverlayColor(color) {
  currentColor = color;
  colorOverlay.style.transition = colorOverlay.style.transition
    ? colorOverlay.style.transition
    : '';
  colorOverlay.style.background = color;
  updateBackButtonContrast(color);
  updatePaletteShadowColor(color);
  updateToneTabsContrast(color);
  updatePaletteViewButtonContrast(color);
  refreshPaletteForCurrentColor(color);
  closePaletteGrid();
}

// 튜토리얼을 거치든(연습 모드) 모빌에서 개체를 바로 클릭하든, 색을 하나씩
// 보여주는 이 화면에 처음 들어왔을 때 한 번만 "모서리를 중앙으로 당겨보라"는
// 힌트를 띄운다. 코너 드래그(모서리를 잡아 가운데로 당기면 페이지가 넘어가듯
// 다음 색으로 바뀌는 제스처)를 처음 보는 사용자를 위한 안내다.
let hasShownCornerDragHint = false;
let cornerDragHintTimer = null;
const cornerDragHint = document.createElement('p');
cornerDragHint.textContent = '화면 모서리를 잡아 가운데로 당겨보세요';
cornerDragHint.style.position = 'fixed';
cornerDragHint.style.top = '18%';
cornerDragHint.style.left = '50%';
cornerDragHint.style.transform = 'translate(-50%, -50%)';
cornerDragHint.style.margin = '0';
cornerDragHint.style.maxWidth = '240px';
cornerDragHint.style.textAlign = 'center';
cornerDragHint.style.fontSize = '13px';
cornerDragHint.style.lineHeight = '1.6';
cornerDragHint.style.zIndex = '1003';
cornerDragHint.style.opacity = '0';
cornerDragHint.style.pointerEvents = 'none';
cornerDragHint.style.transition = 'opacity 0.5s ease';
document.body.appendChild(cornerDragHint);

// 모서리 힌트가 사라진 직후, 이번엔 팔레트 바로 위에 "팔레트에 담아보세요" 힌트를
// 이어서 띄운다. 두 힌트를 동시에 보여주면 정보량이 많아 산만하므로 순서대로.
let paletteDragHintTimer = null;
const paletteDragHint = document.createElement('p');
paletteDragHint.className = 'palette-drag-hint';
paletteDragHint.textContent = '색을 선택해 팔레트에 담아보세요';
paletteDragHint.style.position = 'fixed';
// paletteExpandArrow(팔레트 확장 화살표)가 bottom:124px, height:40px라 위쪽 끝이
// 164px 지점에 있다. 그보다 넉넉히 위(190px)에 둬서 겹치지 않게 한다.
paletteDragHint.style.bottom = '190px';
paletteDragHint.style.left = '50%';
paletteDragHint.style.transform = 'translateX(-50%)';
paletteDragHint.style.margin = '0';
paletteDragHint.style.maxWidth = '240px';
paletteDragHint.style.textAlign = 'center';
paletteDragHint.style.fontSize = '13px';
paletteDragHint.style.lineHeight = '1.6';
paletteDragHint.style.zIndex = '1003';
paletteDragHint.style.opacity = '0';
paletteDragHint.style.pointerEvents = 'none';
paletteDragHint.style.transition = 'opacity 0.5s ease';
document.body.appendChild(paletteDragHint);

// 팔레트 힌트가 사라진 직후, 이번엔 우측 상단(팔레트 아이콘 근처)에 "선택한 색을
// 팔레트에서 확인하세요" 힌트를 이어서 띄운다.
let colorHintTimer = null;
const colorHint = document.createElement('p');
colorHint.textContent = '선택한 색을 팔레트에서 확인하세요';
colorHint.style.position = 'fixed';
colorHint.style.top = 'calc(70px + env(safe-area-inset-top))';
colorHint.style.right = 'calc(20px + env(safe-area-inset-right))';
colorHint.style.margin = '0';
colorHint.style.maxWidth = '130px';
colorHint.style.textAlign = 'right';
colorHint.style.fontSize = '13px';
colorHint.style.lineHeight = '1.6';
colorHint.style.zIndex = '1003';
colorHint.style.opacity = '0';
colorHint.style.pointerEvents = 'none';
colorHint.style.transition = 'opacity 0.5s ease';
document.body.appendChild(colorHint);

// hide*Hint()는 취소/화면 이탈 시에도 안전하게 호출할 수 있어야 하므로 그 자체로는
// 다음 힌트로 이어지지 않는다("숨기기"만 한다). 다음 힌트로 이어지는 건 오직 타이머가
// 자연스럽게 다 돼서 스스로 사라질 때(advance* 함수)뿐이다.
// 세 번째 힌트가 뜰 때 팔레트 아이콘(우측 상단)에 은은한 발광을 준다. 색 확정 때
// 흔들리며 반짝하는 paletteIconGlow와는 별개의 전용 요소라, 그쪽 애니메이션에
// 영향을 주지 않는다. 문구와 같은 타이밍에 나타났다가, 문구보다 천천히 사라진다.
const colorHintGlow = document.createElement('div');
colorHintGlow.className = 'palette-icon-hint-glow';
document.body.appendChild(colorHintGlow);

function hideColorHint() {
  clearTimeout(colorHintTimer);
  colorHint.style.opacity = '0';
  colorHintGlow.style.transitionDuration = '1.8s';
  colorHintGlow.style.opacity = '0';
}

function showColorHint(color) {
  if (isPaletteGridOpen || currentPaletteMode.startsWith('confirmed')) return;
  const { l } = hexToHSL(color);
  colorHint.style.color = l < 50 ? '#ffffff' : '#111111';
  colorHint.style.opacity = '1';
  clearTimeout(colorHintTimer);
  colorHintTimer = setTimeout(hideColorHint, 4000);
  colorHintGlow.style.transitionDuration = '0.35s';
  colorHintGlow.style.opacity = '1';
}

function hidePaletteDragHint() {
  clearTimeout(paletteDragHintTimer);
  paletteDragHint.style.opacity = '0';
  paletteCenterGlow.style.transitionDuration = '1.8s';
  paletteCenterGlow.style.opacity = '0';
}

function advancePaletteDragHint() {
  hidePaletteDragHint();
  // 팔레트 힌트의 페이드아웃(0.5초)이 끝난 뒤에 이어서 색 확인 힌트를 띄운다.
  setTimeout(() => showColorHint(currentColor), 500);
}

// 두 번째 힌트가 뜰 때 하단 중앙 팔레트 스와치에 은은한 발광을 준다. 문구가 뜨는
// 순간 빠르게 나타나고, 문구가 사라지는 것보다 천천히(더 오래) 꺼진다.
const paletteCenterGlow = document.createElement('div');
paletteCenterGlow.className = 'palette-center-glow';
document.body.appendChild(paletteCenterGlow);

function showPaletteDragHint(color) {
  if (isPaletteGridOpen || currentPaletteMode.startsWith('confirmed')) return;
  const { l } = hexToHSL(color);
  paletteDragHint.style.color = l < 50 ? '#ffffff' : '#111111';
  paletteDragHint.style.opacity = '1';
  clearTimeout(paletteDragHintTimer);
  paletteDragHintTimer = setTimeout(advancePaletteDragHint, 4000);
  paletteCenterGlow.style.transitionDuration = '0.35s';
  paletteCenterGlow.style.opacity = '1';
}

function hideCornerDragHint() {
  clearTimeout(cornerDragHintTimer);
  cornerDragHint.style.opacity = '0';
}

// 페이지(색 카드)를 넘기는 순간에도 힌트 체인이 끊기지 않고 이어지도록, 자연스러운
// 4초 타임아웃 쪽과 "실제로 모서리를 잡아 넘기기 시작함" 쪽 둘 다 이 함수를 거친다.
// 튜토리얼을 거쳐 들어왔을 때만 다음 힌트로 이어간다(카드 바로 클릭해 들어온
// 경우는 모서리 힌트 하나만 보여주고 끝낸다).
let hintChainFromTutorial = false;
function advanceCornerDragHint() {
  hideCornerDragHint();
  if (hintChainFromTutorial) {
    setTimeout(() => showPaletteDragHint(currentColor), 500);
  }
}

function maybeShowCornerDragHint(color, fromTutorial) {
  if (hasShownCornerDragHint) return;
  hasShownCornerDragHint = true;
  hintChainFromTutorial = fromTutorial;
  const { l } = hexToHSL(color);
  cornerDragHint.style.color = l < 50 ? '#ffffff' : '#111111';
  cornerDragHint.style.opacity = '1';
  clearTimeout(cornerDragHintTimer);
  cornerDragHintTimer = setTimeout(advanceCornerDragHint, 4000);
}

function showColorOverlay(color, x, y) {
  lastClickPoint = { x, y };
  currentColor = color;
  closePaletteGrid();
  curlCtx.clearRect(0, 0, curlCanvas.width, curlCanvas.height);
  colorOverlay.style.background = color;
  updateBackButtonContrast(color);
  updatePaletteShadowColor(color);
  updateToneTabsContrast(color);
  updatePaletteViewButtonContrast(color);
  colorOverlay.style.pointerEvents = 'auto';

  const maxRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  colorOverlay.style.transitionProperty = 'clip-path';
  colorOverlay.style.transitionDuration = '0s';
  colorOverlay.style.clipPath = `circle(0px at ${x}px ${y}px)`;
  void colorOverlay.offsetWidth;
  colorOverlay.style.transitionDuration = '0.7s';
  colorOverlay.style.transitionTimingFunction = 'cubic-bezier(0.4, 0, 0.2, 1)';
  colorOverlay.style.clipPath = `circle(${maxRadius}px at ${x}px ${y}px)`;

  renderPalette(color);
  backButton.style.opacity = '1';
  backButton.style.pointerEvents = 'auto';
  paletteBar.style.opacity = '1';
  paletteBar.style.pointerEvents = 'auto';
  paletteCenterShadow.style.opacity = '1';
  paletteExpandArrow.style.opacity = '1';
  paletteExpandArrow.style.pointerEvents = 'auto';
  // Warm/Cool 탭, 체크 표시, 팔레트(확정 목록) 아이콘은 여기서 켜지 않는다 —
  // 튜토리얼을 거친 실전 모드(enterPracticeMode)에서만 보인다.

  // 첫 화면(메인 모빌)을 벗어났으니 튜토리얼 아이콘은 숨긴다.
  setHomeIconsOpacity('0');

  maybeShowCornerDragHint(color, false);
}

// 튜토리얼을 막 마치고 처음 색 화면으로 들어올 때 전용. 카드를 직접 클릭한 게
// 아니라 원의 중심이 될 뚜렷한 클릭 지점이 없으므로, showColorOverlay처럼 한
// 점에서 원이 커지며 퍼지는 대신 색이 그 자리에서 서서히 진해지며(페이드인)
// 화면을 채운다. 나머지(팔레트 렌더링, 버튼 표시 등) 설정은 동일하다.
function showColorOverlayFade(color) {
  const x = window.innerWidth / 2;
  const y = window.innerHeight / 2;
  lastClickPoint = { x, y };
  currentColor = color;
  closePaletteGrid();
  curlCtx.clearRect(0, 0, curlCanvas.width, curlCanvas.height);
  colorOverlay.style.background = color;
  updateBackButtonContrast(color);
  updatePaletteShadowColor(color);
  updateToneTabsContrast(color);
  updatePaletteViewButtonContrast(color);
  colorOverlay.style.pointerEvents = 'auto';

  // clip-path는 화면 전체를 덮도록 즉시 고정해두고(더 이상 원 확장에 안 쓴다),
  // opacity만 0→1로 서서히 올려 "색이 진해지며 채워지는" 느낌을 낸다.
  const maxRadius = Math.hypot(window.innerWidth, window.innerHeight);
  colorOverlay.style.transitionProperty = 'opacity';
  colorOverlay.style.transitionDuration = '0s';
  colorOverlay.style.clipPath = `circle(${maxRadius}px at ${x}px ${y}px)`;
  colorOverlay.style.opacity = '0';
  void colorOverlay.offsetWidth;
  colorOverlay.style.transitionDuration = '1s';
  colorOverlay.style.transitionTimingFunction = 'ease';
  colorOverlay.style.opacity = '1';

  renderPalette(color);
  backButton.style.opacity = '1';
  backButton.style.pointerEvents = 'auto';
  paletteBar.style.opacity = '1';
  paletteBar.style.pointerEvents = 'auto';
  paletteCenterShadow.style.opacity = '1';
  paletteExpandArrow.style.opacity = '1';
  paletteExpandArrow.style.pointerEvents = 'auto';

  setHomeIconsOpacity('0');

  maybeShowCornerDragHint(color, true);
}

function hideColorOverlay() {
  hideCornerDragHint();
  hidePaletteDragHint();
  hideColorHint();
  const { x, y } = lastClickPoint;
  colorOverlay.style.transitionProperty = 'clip-path';
  colorOverlay.style.transitionDuration = '0.6s';
  colorOverlay.style.transitionTimingFunction = 'cubic-bezier(0.4, 0, 0.2, 1)';
  colorOverlay.style.clipPath = `circle(0px at ${x}px ${y}px)`;
  colorOverlay.style.pointerEvents = 'none';

  backButton.style.opacity = '0';
  backButton.style.pointerEvents = 'none';
  paletteBar.style.opacity = '0';
  paletteBar.style.pointerEvents = 'none';
  paletteCenterShadow.style.opacity = '0';
  paletteExpandArrow.style.opacity = '0';
  paletteExpandArrow.style.pointerEvents = 'none';
  isPracticeMode = false;
  paletteToneTabs.style.opacity = '0';
  paletteToneTabs.style.pointerEvents = 'none';
  paletteViewButton.style.opacity = '0';
  paletteViewButton.style.pointerEvents = 'none';
  stageAdvanceButton.style.opacity = '0';
  stageAdvanceButton.style.pointerEvents = 'none';
  stageHintOverlay.style.opacity = '0';
  stageHintOverlay.style.pointerEvents = 'none';
  synthesisBackdrop.style.opacity = '0';
  synthesisBackdrop.style.pointerEvents = 'none';
  endButton.style.opacity = '0';
  endButton.style.pointerEvents = 'none';
  pendingStageIntro = null;
  pendingFinalSeason = null;
  practiceStage = 'tone';
  stageNavStack = [];
  closePaletteGrid();

  // 첫 화면(메인 모빌)으로 돌아왔으니 튜토리얼 아이콘과 상단 계절 탭을 다시 보여준다.
  setHomeIconsOpacity('1');
  toneButtonsEl.style.opacity = '1';
  toneButtonsEl.style.pointerEvents = 'auto';
}

// "확정한 색" 화면(과 그 안의 웜/쿨 필터) 안에서는 뒤로가기가 화면 전체를 나가지
// 않고 들어오기 직전 화면(3단계 이후의 실전 화면)으로만 되돌아간다.
backButton.addEventListener('click', () => {
  if (letterPaletteReturnActive) {
    exitSeasonPaletteToLetter();
  } else if (currentPaletteMode.startsWith('confirmed')) {
    restorePreviousPaletteView();
  } else if (isPracticeMode && stageNavStack.length > 0) {
    // 색 화면에 들어올 때마다 쌓아둔 스택을 하나씩 꺼내 정확히 바로 이전 화면
    // (보통은 지금 단계의 안내 카드)으로 되돌아간다.
    goStageNavEntry(stageNavStack.pop());
  } else {
    hideColorOverlay();
  }
});

const CORNER_GRAB_RADIUS = 160;
const COMMIT_PROGRESS = 0.35;

let pageDrag = null;

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function getNextColor() {
  const nextIndex = (currentPaletteIndex + 1) % currentPalette.length;
  return { color: currentPalette[nextIndex], index: nextIndex };
}

function edgeVectorsForCorner(id) {
  switch (id) {
    case 'tl': return { e1: { x: 1, y: 0 }, e2: { x: 0, y: 1 } };
    case 'tr': return { e1: { x: -1, y: 0 }, e2: { x: 0, y: 1 } };
    case 'bl': return { e1: { x: 1, y: 0 }, e2: { x: 0, y: -1 } };
    case 'br': return { e1: { x: -1, y: 0 }, e2: { x: 0, y: -1 } };
    default: return { e1: { x: 1, y: 0 }, e2: { x: 0, y: 1 } };
  }
}

const CURVE_BULGE_MIN = 0.06;
const CURVE_BULGE_MAX = 0.48;
const CURVE_RAMP = 1.7;

function curveBulgeForProgress(progress) {
  const p = Math.min(1, Math.max(0, progress));
  const eased = 1 - Math.pow(1 - Math.min(1, p * CURVE_RAMP), 2);
  return CURVE_BULGE_MIN + (CURVE_BULGE_MAX - CURVE_BULGE_MIN) * eased;
}

function renderCurl(C, P, e1, e2, frontColor, shrinkT = 0, shrinkTarget = C, baseColor = frontColor) {
  const w = window.innerWidth, h = window.innerHeight;
  curlCtx.clearRect(0, 0, w, h);

  curlCtx.fillStyle = baseColor;
  curlCtx.fillRect(0, 0, w, h);

  const dx = P.x - C.x, dy = P.y - C.y;
  const d = Math.hypot(dx, dy);
  if (d < 4) return;

  const nx = dx / d, ny = dy / d;
  const mx = (C.x + P.x) / 2, my = (C.y + P.y) / 2;

  let A;
  if (Math.abs(nx) < 0.001) {
    A = { x: C.x, y: C.y };
  } else {
    const ax = mx - (ny * (C.y - my)) / nx;
    A = { x: e1.x > 0 ? Math.min(Math.max(ax, C.x), w) : Math.max(Math.min(ax, C.x), 0), y: C.y };
  }

  let B;
  if (Math.abs(ny) < 0.001) {
    B = { x: C.x, y: C.y };
  } else {
    const by = my - (nx * (C.x - mx)) / ny;
    B = { x: C.x, y: e2.y > 0 ? Math.min(Math.max(by, C.y), h) : Math.max(Math.min(by, C.y), 0) };
  }

  const GAP_RATIO = 0.97;
  const distCA = distance(C.x, C.y, A.x, A.y);
  const distCB = distance(C.x, C.y, B.x, B.y);
  const gapA = {
    x: C.x + e1.x * (distCA * GAP_RATIO),
    y: C.y + e1.y * (distCA * GAP_RATIO),
  };
  const gapB = {
    x: C.x + e2.x * (distCB * GAP_RATIO),
    y: C.y + e2.y * (distCB * GAP_RATIO),
  };

  const TANGENT_STRENGTH_A = -0.1;
  const TANGENT_STRENGTH_B = -0.1;
  const HOOK_SIDE_A = 0;
  const HOOK_SIDE_B = 0;

  const dAP = distance(A.x, A.y, P.x, P.y);
  const dPB = distance(B.x, B.y, P.x, P.y);

  const perpA = { x: -e1.y, y: e1.x };
  const cp1 = {
    x: A.x + e1.x * (dAP * TANGENT_STRENGTH_A) + perpA.x * (dAP * HOOK_SIDE_A),
    y: A.y + e1.y * (dAP * TANGENT_STRENGTH_A) + perpA.y * (dAP * HOOK_SIDE_A),
  };

  const perpB = { x: -e2.y, y: e2.x };
  const cp2 = {
    x: B.x + e2.x * (dPB * TANGENT_STRENGTH_B) + perpB.x * (dPB * HOOK_SIDE_B),
    y: B.y + e2.y * (dPB * TANGENT_STRENGTH_B) + perpB.y * (dPB * HOOK_SIDE_B),
  };

  const shiftX = (shrinkTarget.x - C.x) * shrinkT;
  const shiftY = (shrinkTarget.y - C.y) * shrinkT;
  const shiftToTarget = (pt) => ({ x: pt.x + shiftX, y: pt.y + shiftY });

  const gapA_raw = shiftToTarget(gapA);
  const gapB_raw = shiftToTarget(gapB);
  const A_raw = shiftToTarget(A);
  const B_raw = shiftToTarget(B);

  const gapA_ = { x: gapA_raw.x, y: C.y };
  const gapB_ = { x: C.x, y: gapB_raw.y };
  const A_ = { x: A_raw.x, y: C.y };
  const B_ = { x: C.x, y: B_raw.y };

  const P_ = shiftToTarget(P);
  const cp1_ = shiftToTarget(cp1);
  const cp2_ = shiftToTarget(cp2);

  const { color: nextColorForGap } = getNextColor();
  curlCtx.save();
  curlCtx.shadowColor = 'transparent';
  curlCtx.shadowBlur = 0;
  curlCtx.shadowOffsetX = 0;
  curlCtx.shadowOffsetY = 0;
  curlCtx.fillStyle = nextColorForGap;
  curlCtx.beginPath();
  curlCtx.moveTo(C.x, C.y);
  curlCtx.lineTo(gapA_.x, gapA_.y);
  curlCtx.lineTo(gapB_.x, gapB_.y);
  curlCtx.closePath();
  curlCtx.fill();
  curlCtx.restore();

  curlCtx.save();

  const flapPath = new Path2D();
  flapPath.moveTo(gapA_.x, gapA_.y);
  flapPath.lineTo(A_.x, A_.y);
  flapPath.quadraticCurveTo(cp1_.x, cp1_.y, P_.x, P_.y);
  flapPath.quadraticCurveTo(cp2_.x, cp2_.y, B_.x, B_.y);
  flapPath.lineTo(gapB_.x, gapB_.y);
  flapPath.closePath();

  const backTone = darkenHex(frontColor, 0.55);

  curlCtx.shadowColor = 'rgba(0,0,0,0.45)';
  curlCtx.shadowBlur = 55;
  curlCtx.shadowOffsetX = nx * 22;
  curlCtx.shadowOffsetY = ny * 22;
  curlCtx.fillStyle = backTone;
  curlCtx.fill(flapPath);

  curlCtx.restore();
}

function startPageDrag(x, y) {
  if (colorOverlay.style.pointerEvents !== 'auto') return null;
  const w = window.innerWidth, h = window.innerHeight;
  const cornerDefs = [
    { id: 'tl', cx: 0, cy: 0 },
    { id: 'tr', cx: w, cy: 0 },
    { id: 'bl', cx: 0, cy: h },
    { id: 'br', cx: w, cy: h },
  ];
  let nearest = cornerDefs[0];
  let minDist = Infinity;
  cornerDefs.forEach((c) => {
    const dd = distance(x, y, c.cx, c.cy);
    if (dd < minDist) { minDist = dd; nearest = c; }
  });
  if (minDist > CORNER_GRAB_RADIUS) return null;

  const centerX = w / 2, centerY = h / 2;
  const centerDist = distance(nearest.cx, nearest.cy, centerX, centerY);

  const oppositeCornerMap = {
    tl: { x: w, y: h },
    tr: { x: 0, y: h },
    bl: { x: w, y: 0 },
    br: { x: 0, y: 0 },
  };
  const oppositeCorner = oppositeCornerMap[nearest.id];

  const { color: nextColor } = getNextColor();
  const { e1, e2 } = edgeVectorsForCorner(nearest.id);

  // 사용자가 실제로 모서리를 잡아 드래그(페이지 넘기기)를 시작했다. 모서리 힌트는
  // 더 볼 필요가 없으니 치우되, 4초를 다 기다리지 않고 넘겼다고 해서 힌트 체인
  // 자체가 끊기지는 않도록 자연스러운 타임아웃과 같은 진행 함수를 쓴다.
  advanceCornerDragHint();

  return {
    C: { x: nearest.cx, y: nearest.cy },
    e1, e2,
    centerX, centerY, centerDist,
    oppositeCorner,
    nextColor,
    lastP: { x: nearest.cx, y: nearest.cy },
    lastProgress: 0,
  };
}

function updatePageDrag(x, y) {
  if (!pageDrag) return;
  const { C, e1, e2 } = pageDrag;
  const P = { x, y };

  const distToCenter = distance(x, y, pageDrag.centerX, pageDrag.centerY);
  const progress = Math.min(1, Math.max(0, 1 - distToCenter / pageDrag.centerDist));

  pageDrag.lastP = P;
  pageDrag.lastProgress = progress;

  renderCurl(C, P, e1, e2, currentColor);
}

function animateCurl(C, e1, e2, fromP, toP, frontColor, onDone, shrinkFrom = 0, shrinkTo = 0, duration = 480, shrinkTarget = C, baseColor = frontColor) {
  const start = performance.now();
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = easeOutCubic(t);
    const P = {
      x: fromP.x + (toP.x - fromP.x) * eased,
      y: fromP.y + (toP.y - fromP.y) * eased,
    };
    const shrinkT = shrinkFrom + (shrinkTo - shrinkFrom) * eased;
    renderCurl(C, P, e1, e2, frontColor, shrinkT, shrinkTarget, baseColor);
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      onDone && onDone();
    }
  }
  requestAnimationFrame(step);
}

function endPageDrag() {
  if (!pageDrag) return;
  const { C, e1, e2, lastP, lastProgress, nextColor, oppositeCorner } = pageDrag;

  if (lastProgress > COMMIT_PROGRESS) {
    // 종이가 반대 모서리까지 이동하는 동작은 생략하고, 접힌 부분이 반대 모서리로
    // 빨려들어가는(shrink) 연출만 남긴다.
    animateCurl(C, e1, e2, oppositeCorner, oppositeCorner, currentColor, () => {
      currentColor = nextColor;
      colorOverlay.style.background = currentColor;
      updateBackButtonContrast(currentColor);
      updatePaletteShadowColor(currentColor);
      updateToneTabsContrast(currentColor);
      updatePaletteViewButtonContrast(currentColor);
      curlCtx.clearRect(0, 0, curlCanvas.width, curlCanvas.height);
      refreshPaletteForCurrentColor(currentColor);
      const idx = currentPalette.findIndex(c => c.toLowerCase() === nextColor.toLowerCase());
      currentPaletteIndex = idx >= 0 ? idx : 0;
    }, 0, 1, 340, oppositeCorner, nextColor);
  } else {
    animateCurl(C, e1, e2, lastP, C, currentColor, () => {
      curlCtx.clearRect(0, 0, curlCanvas.width, curlCanvas.height);
    });
  }

  pageDrag = null;
}

colorOverlay.addEventListener('mousedown', (e) => {
  pageDrag = startPageDrag(e.clientX, e.clientY);
});
window.addEventListener('mousemove', (e) => {
  if (pageDrag) updatePageDrag(e.clientX, e.clientY);
});
window.addEventListener('mouseup', () => {
  if (pageDrag) endPageDrag();
});

colorOverlay.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  pageDrag = startPageDrag(t.clientX, t.clientY);
});
window.addEventListener('touchmove', (e) => {
  if (pageDrag) updatePageDrag(e.touches[0].clientX, e.touches[0].clientY);
});
window.addEventListener('touchend', () => {
  if (pageDrag) endPageDrag();
});

const TONE_FAMILY_COUNT = 4;
const TONE_BG_LIGHTNESS = 92;
const TONE_BG_SAT_CAP = 45;

function averageFamilyHSL(hexArray) {
  let sumSin = 0, sumCos = 0, sumS = 0;
  hexArray.forEach((hex) => {
    const { h, s } = hexToHSL(hex);
    const rad = (h * Math.PI) / 180;
    const w = Math.max(s, 1); // 무채색(검/흰)이 평균 색상(hue)을 왜곡하지 않도록 채도로 가중치를 준다.
    sumSin += Math.sin(rad) * w;
    sumCos += Math.cos(rad) * w;
    sumS += s;
  });
  let avgH = (Math.atan2(sumSin, sumCos) * 180) / Math.PI;
  if (avgH < 0) avgH += 360;
  return { h: avgH, s: sumS / hexArray.length };
}

function paleFamilyColor(hexArray) {
  const { h, s } = averageFamilyHSL(hexArray);
  return hslToHex(h, Math.min(s, TONE_BG_SAT_CAP), TONE_BG_LIGHTNESS);
}

// 각 톤 구간(봄/여름/가을/겨울)에 실제로 쓰인 색상들을 평균 내 연한 배경색을 만든다.
const familySegment = count / TONE_FAMILY_COUNT;
const toneColors = Array.from({ length: TONE_FAMILY_COUNT }, (_, i) =>
  paleFamilyColor(colors.slice(i * familySegment, (i + 1) * familySegment))
);

const sections = toneColors.map((color, i) => {
  const segment = count / toneColors.length;
  const start = Math.round(segment * i);
  const end = Math.round(segment * (i + 1)) - 1;
  return { start, end, color };
});
sections[sections.length - 1].end = count - 1;

function lerpColor(a, b, t) {
  const parse = (hex) => {
    const h = hex.replace('#', '');
    return {
      r: parseInt(h.slice(0,2),16),
      g: parseInt(h.slice(2,4),16),
      b: parseInt(h.slice(4,6),16),
      a: h.length === 8 ? parseInt(h.slice(6,8),16) / 255 : 1
    };
  };
  const ac = parse(a), bc = parse(b);
  const r = Math.round(ac.r + (bc.r - ac.r) * t);
  const g = Math.round(ac.g + (bc.g - ac.g) * t);
  const bl = Math.round(ac.b + (bc.b - ac.b) * t);
  const al = (ac.a + (bc.a - ac.a) * t).toFixed(3);
  return `rgba(${r},${g},${bl},${al})`;
}

function updateToneButtons(frontValue) {
  const buttons = document.querySelectorAll('.tone-buttons button');
  buttons.forEach((btn, i) => {
    let raw = i - frontValue;
    raw = ((raw + 2) % 4 + 4) % 4 - 2;
    const isCenter = Math.abs(raw) < 0.5;

    btn.style.color = isCenter ? '#0a0a0a' : '#999999';
  });
}

function updateBg() {
  const normalized = ((rotationOffset % 360) + 360) % 360;
  // 카드 pivot은 baseAngle + rotationOffset 이 0°일 때 정면에 오므로,
  // 정면에 와 있는 카드의 인덱스는 rotationOffset의 반대 방향(360 - normalized)으로 구한다.
  const frontAngle = (360 - normalized) % 360;
  const pos = (frontAngle / 360) * count;
  const index = Math.floor(pos) % count;
  const t = pos - Math.floor(pos);

  const curSection = sections.findIndex(s => index >= s.start && index <= s.end);
  const nextIndex = (index + 1) % count;
  const nextSection = sections.findIndex(s => nextIndex >= s.start && nextIndex <= s.end);

  if (curSection === -1 || nextSection === -1) return;

  let bgColor;
  if (curSection === nextSection) {
    bgColor = lerpColor(sections[curSection].color, sections[curSection].color, 0);
  } else {
    bgColor = lerpColor(sections[curSection].color, sections[nextSection].color, t);
  }
  document.body.style.background = bgColor;
  updateSiteFooterContrast(bgColor);

  // 톤 버튼은 goToTone()이 각 구간의 "가운데 카드"를 정면으로 가져오므로,
  // 그 가운데 카드 인덱스를 기준으로 삼아야 frontValue가 정수(=완전 중앙)로 떨어진다.
  const segment = count / toneColors.length;
  const midOffset = Math.floor((sections[0].start + sections[0].end) / 2);
  const frontValue = (((pos - midOffset) / segment) % toneColors.length + toneColors.length) % toneColors.length;
  updateToneButtons(frontValue);
}

// filter: blur()는 개체 200개에 매 프레임 걸리는 가장 무거운 효과라 모바일/태블릿에서
// 깜빡임(리페인트 과부하)의 주 원인이 되기 쉽다. 그 기기들에서는 블러를 끈다.
const MAX_DEPTH_BLUR = isLikelyMobile ? 0 : 10;
const MIN_DEPTH_OPACITY = 0.15;
const MIN_DEPTH_SATURATION = 0.02;
const MIN_DEPTH_BRIGHTNESS = 0.45;
// 중앙에서 조금만 벗어나도 빠르게 흐려지도록 거리 반응 범위를 좁힌다.
const DEPTH_T_SCALE = 1.8;

const TARGET_THETA_DEG = 330;
const LIT_COUNT = 3;

// 한 톤 계열이 "딱" 정중앙에 왔다고 볼 허용 오차(작을수록 더 정확히 맞아야 잠김).
const SECTION_LOCK_THRESHOLD = 0.08;

function applyLayout() {
  const litCandidates = [];

  // 톤 버튼과 같은 연속값(frontValue, 0~4)으로 지금 어느 구간이 정중앙에 가장 가까운지 구한다.
  const normalizedFront = ((rotationOffset % 360) + 360) % 360;
  const frontAngleNow = (360 - normalizedFront) % 360;
  const posNow = (frontAngleNow / 360) * count;
  const segmentNow = count / TONE_FAMILY_COUNT;
  const midOffsetNow = Math.floor((sections[0].start + sections[0].end) / 2);
  const frontValueNow =
    (((posNow - midOffsetNow) / segmentNow) % TONE_FAMILY_COUNT + TONE_FAMILY_COUNT) % TONE_FAMILY_COUNT;
  const nearestSection = Math.round(frontValueNow) % TONE_FAMILY_COUNT;
  const sectionIsLocked = Math.abs(frontValueNow - Math.round(frontValueNow)) < SECTION_LOCK_THRESHOLD;

  pivotCardPairs.forEach(({ pivot, card }) => {
    const angle = parseFloat(pivot.dataset.baseAngle) + rotationOffset;
    pivot.style.transform = `rotateY(${angle}deg)`;

    const radius = parseFloat(pivot.dataset.radius);
    const rad = (angle % 360) * Math.PI / 180;
    const effectiveZ = radius * Math.cos(rad);

    const t = Math.min(1, Math.max(0, ((radius - effectiveZ) / (2 * radius)) * DEPTH_T_SCALE));
    const blur = t * MAX_DEPTH_BLUR;
    // 중앙에서 멀어질수록(t 증가) 투명도·채도·명도가 함께 낮아지되, 채도는 더 낮은 바닥까지 떨어진다.
    const opacity = 1 - t * (1 - MIN_DEPTH_OPACITY);
    let saturation = introActive ? 1 : 1 - t * (1 - MIN_DEPTH_SATURATION);
    let brightness = introActive ? 1 : 1 - t * (1 - MIN_DEPTH_BRIGHTNESS);

    if (card) {
      // 한 계열이 딱 정중앙에 왔을 때는 그 계열이 아닌 개체는 채도를 완전히 0으로.
      // 단, 원래 색이 어두우면 회색조가 너무 새까매져 눈에 띄므로 명도가 90% 밑으로 떨어지지 않게 보정한다.
      // (인트로 동안에는 이 조정도 하지 않는다.)
      if (!introActive && sectionIsLocked && pivot.dataset.section !== undefined) {
        const pivotSection = parseInt(pivot.dataset.section, 10);
        if (pivotSection !== nearestSection) {
          saturation = 0;
          const originalLightness = hexToHSL(card.dataset.color).l; // 0~100
          const grayLightness = originalLightness * brightness;
          if (grayLightness < 90) {
            brightness *= 90 / Math.max(1, originalLightness);
          }
        }
      }

      card.style.filter = `blur(${blur.toFixed(2)}px) saturate(${saturation.toFixed(3)}) brightness(${brightness.toFixed(3)})`;
      card.style.opacity = opacity.toFixed(3);

      const normalizedAngle = ((angle % 360) + 360) % 360;
      let diff = Math.abs(normalizedAngle - TARGET_THETA_DEG);
      if (diff > 180) diff = 360 - diff;
      litCandidates.push({ card, diff });
    }
  });

  litCandidates.sort((a, b) => a.diff - b.diff);
  litCandidates.forEach((entry, idx) => {
    entry.card.classList.toggle('lit', idx < LIT_COUNT);
  });

  updateBg();
}

applyLayout();

// 인트로 동안(약 1.5초, braking이 켜지기 전까지)은 더 빠르게 돌다가, 이후 빠르게 감속해 멈춘다.
// 모바일/태블릿에서는 전체적으로 조금 더 느리게 돈다.
const IDLE_SPEED = isLikelyMobile ? 0.06 : 0.1;
let speed = isLikelyMobile ? 3 : 5;
let braking = false;
const brakingRate = 0.92;

// 튜토리얼/스테이지 힌트 오버레이가 떠 있는 동안은 배경 모빌이 계속 자기 혼자 돌고 있는 것처럼
// 보여 카드를 드래그해도 반응이 없고 배경만 움직이는 것처럼 오해되므로, 이 동안은 회전을 멈춘다.
// (tick()이 처음 실행되는 시점에는 아직 tutorialOverlay가 선언되기 전이라 그 변수를 직접
// 참조할 수 없어, openTutorial/closeTutorial에서 갱신하는 별도 플래그를 둔다. stageHintOverlay는
// tick()보다 앞에서 선언되므로 pointerEvents로 바로 판단할 수 있다.)
let isTutorialOpen = false;

function tick() {
  const isStageHintOpen = stageHintOverlay.style.pointerEvents === 'auto';
  if (!isDragging && !isTutorialOpen && !isStageHintOpen && (autoRotate || braking)) {
    if (braking) {
      speed *= brakingRate;
      if (speed < IDLE_SPEED) {
        speed = IDLE_SPEED;
      }
    }
    rotationOffset += speed;
    applyLayout();
  }
  requestAnimationFrame(tick);
}
tick();

stage.addEventListener('mousedown', (e) => {
  isDragging = true;
  startX = e.clientX;
  startRotation = rotationOffset;
  dragDistance = 0;
});
window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const delta = e.clientX - startX;
  dragDistance = Math.abs(delta);
  rotationOffset = startRotation + delta * 0.3;
  applyLayout();
});
window.addEventListener('mouseup', () => { isDragging = false; });

stage.addEventListener('touchstart', (e) => {
  isDragging = true;
  startX = e.touches[0].clientX;
  startRotation = rotationOffset;
  dragDistance = 0;
});
window.addEventListener('touchmove', (e) => {
  if (!isDragging) return;
  const delta = e.touches[0].clientX - startX;
  dragDistance = Math.abs(delta);
  rotationOffset = startRotation + delta * 0.3;
  applyLayout();
});
window.addEventListener('touchend', () => { isDragging = false; });

window.addEventListener('wheel', (e) => {
  rotationOffset += e.deltaY * 0.05;
  applyLayout();
}, { passive: true });

const CLICK_DRAG_THRESHOLD = 6;
stage.addEventListener('click', (e) => {
  if (dragDistance > CLICK_DRAG_THRESHOLD) return;
  const card = e.target.closest('.card');
  if (!card) return;
  showColorOverlay(card.dataset.color, e.clientX, e.clientY);
});

// 개체 자체가 빛나는 게 아니라, 카메라 렌즈 플레어처럼 화면 전체에 빛이 번지는 효과.
// 호버한 개체 위치 → 화면 중심을 지나 반대편까지 이어지는 선을 따라 옅은 빛 번짐들을 배치한다.
const lensFlare = document.createElement('div');
lensFlare.style.position = 'fixed';
lensFlare.style.inset = '0';
lensFlare.style.zIndex = '5';
lensFlare.style.pointerEvents = 'none';
lensFlare.style.opacity = '0';
lensFlare.style.transition = 'opacity 0.5s ease';
lensFlare.style.mixBlendMode = 'screen';
document.body.appendChild(lensFlare);

// 프리즘에 빛이 반사되듯 무지개 순서(빨-주-노-초-파-보)로 배치한다.
// 색이 잘 보이도록 채도/불투명도를 높이고 블러는 줄였다.
const LENS_FLARE_STEPS = [
  { frac: -0.3, size: 200, blur: 30, color: 'hsla(0, 70%, 78%, 0.24)' },
  { frac: 0.05, size: 50,  blur: 8,  color: 'hsla(30, 75%, 68%, 0.2)' },
  { frac: 0.5,  size: 120, blur: 16, color: 'hsla(55, 70%, 70%, 0.17)' },
  { frac: 0.95, size: 32,  blur: 5,  color: 'hsla(150, 65%, 65%, 0.2)' },
  { frac: 1.4,  size: 84,  blur: 12, color: 'hsla(210, 70%, 70%, 0.18)' },
  { frac: 1.85, size: 160, blur: 20, color: 'hsla(280, 65%, 72%, 0.16)' },
];

const lensFlareEls = LENS_FLARE_STEPS.map((step) => {
  const el = document.createElement('div');
  el.style.position = 'absolute';
  el.style.width = step.size + 'px';
  el.style.height = step.size + 'px';
  el.style.borderRadius = '50%';
  el.style.background = step.color;
  el.style.filter = `blur(${step.blur}px)`;
  el.style.transform = 'translate(-50%, -50%)';
  lensFlare.appendChild(el);
  return el;
});

function showLensFlareAt(hx, hy) {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const mx = 2 * cx - hx; // 화면 중심을 기준으로 개체 반대편 지점
  const my = 2 * cy - hy;

  LENS_FLARE_STEPS.forEach((step, i) => {
    lensFlareEls[i].style.left = (hx + (mx - hx) * step.frac) + 'px';
    lensFlareEls[i].style.top = (hy + (my - hy) * step.frac) + 'px';
  });

  lensFlare.style.opacity = '1';
}

function hideLensFlare() {
  lensFlare.style.opacity = '0';
}

stage.addEventListener('mouseover', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  const rect = card.getBoundingClientRect();
  showLensFlareAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
});
stage.addEventListener('mouseout', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  hideLensFlare();
});

function goToTone(sectionIndex) {
  const s = sections[sectionIndex];
  const midCard = Math.floor((s.start + s.end) / 2);
  const targetAngle = -(360 / count) * midCard;

  const current = rotationOffset % 360;
  let delta = (targetAngle - current) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;

  rotationOffset += delta;
  braking = false;
  autoRotate = false;

  stage.classList.add('animating');
  applyLayout();

  setTimeout(() => {
    stage.classList.remove('animating');
    speed = IDLE_SPEED;
    autoRotate = true;
  }, 1200);
}

const tutorialOverlay = document.getElementById('tutorialOverlay');
const tutorialShortcutEl = document.getElementById('tutorialShortcut');

// 사용자의 OS/브라우저에 맞는 "탭·주소창 숨김" 전체화면 단축키를 안내한다.
function getFullscreenShortcut() {
  const ua = navigator.userAgent;
  const isMac = /Mac|Macintosh/.test(navigator.platform || ua);

  if (isLikelyMobile) {
    return '주소창을 아래로 스크롤해서 숨겨보세요';
  }

  if (!isMac) {
    // 윈도우/리눅스/크롬OS는 대부분 브라우저가 F11로 동일하게 동작한다.
    return 'F11';
  }

  const isEdge = /Edg\//.test(ua);
  const isChrome = /Chrome\//.test(ua) && !isEdge;

  // 크롬(맥)만 탭·주소창을 숨기는 별도 단축키(Shift+Cmd+F)를 갖고, 그 외
  // 사파리/엣지/파이어폭스는 macOS 기본 전체화면 단축키(Ctrl+Cmd+F)를 쓴다.
  if (isChrome) return '⇧ Shift + ⌘ Command + F';
  return '⌃ Control + ⌘ Command + F';
}

tutorialShortcutEl.textContent = getFullscreenShortcut();

const tutorialSlides = Array.from(tutorialOverlay.querySelectorAll('.tutorial-slide'));
let tutorialIndex = 0;
// 전체화면 단축키 안내(첫 슬라이드)는 키보드 단축키가 있는 데스크탑에서만 의미가
// 있으므로, 모바일에서는 이 슬라이드를 건너뛰고 바로 다음 슬라이드부터 시작한다.
const TUTORIAL_START_INDEX = isLikelyMobile ? 1 : 0;

function renderTutorialSlide() {
  tutorialSlides.forEach((slide, i) => slide.classList.toggle('active', i === tutorialIndex));
}

function openTutorial() {
  tutorialIndex = TUTORIAL_START_INDEX;
  renderTutorialSlide();
  tutorialOverlay.classList.add('active');
  isTutorialOpen = true;
  // 튜토리얼 아이콘은 첫 화면(메인 모빌)에서만 보여야 하므로, 튜토리얼을 여는
  // 순간부터는 숨긴다(안 그러면 반투명한 오버레이 뒤로 비쳐 보인다).
  setHomeIconsOpacity('0');
}

function closeTutorial() {
  tutorialOverlay.classList.remove('active');
  isTutorialOpen = false;
}

// 현재 회전 중인 카드들 중 정면에 와 있는 색을 그대로 실전 화면의 시작 색으로 쓴다.
function getFrontCardColor() {
  const normalized = ((rotationOffset % 360) + 360) % 360;
  const frontAngle = (360 - normalized) % 360;
  const pos = (frontAngle / 360) * count;
  const index = Math.floor(pos) % count;
  return colors[index];
}

// 마지막 슬라이드(1차 드레이핑 설명)에서 튜토리얼을 마치면, 다른 단계 전환 때와 똑같이
// 먼저 단계 2(언더톤) 안내 카드를 보여준 뒤, 그 화면을 눌러야 실제 컬러 화면(웜/쿨 탭)이
// 시작되게 한다. (예전에는 이 안내를 건너뛰고 바로 팔레트로 들어가서 단계 2 카드가 절대
// 보이지 않는 문제가 있었다.)
function enterPracticeMode() {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  isPracticeMode = true;
  stageNavStack = [];
  pendingPracticeEntryPoint = { cx, cy };
  showStageHintScreen('tone');
}

// 넥스트 버튼을 누르거나 좌우로 스와이프해야 다음으로 넘어가고, 마지막 슬라이드에서는 닫히며 실전 화면으로 이어진다.
// (배경을 그냥 탭하기만 해서는 넘어가지 않는다.)
function advanceTutorial() {
  if (tutorialIndex < tutorialSlides.length - 1) {
    tutorialIndex += 1;
    renderTutorialSlide();
  } else {
    closeTutorial();
    enterPracticeMode();
  }
}

// 첫 슬라이드에서 더 뒤로 갈 곳이 없으면 튜토리얼을 종료한다.
function rewindTutorial() {
  if (tutorialIndex > TUTORIAL_START_INDEX) {
    tutorialIndex -= 1;
    renderTutorialSlide();
  } else {
    closeTutorial();
    // 튜토리얼을 취소하고 첫 화면으로 돌아왔으니 아이콘을 다시 보여준다.
    setHomeIconsOpacity('1');
  }
}

const tutorialBackButton = document.getElementById('tutorialBack');
tutorialBackButton.addEventListener('click', (e) => {
  e.stopPropagation();
  rewindTutorial();
});

const tutorialNextButton = document.getElementById('tutorialNext');
tutorialNextButton.addEventListener('click', (e) => {
  e.stopPropagation();
  advanceTutorial();
});

// 데스크탑에서는 Back 버튼(자기 핸들러에서 stopPropagation으로 걸러짐) 말고
// 배경 어디를 클릭해도 다음으로 넘어간다. 모바일은 실수로 스크롤/스와이프하다
// 잘못 넘어가는 걸 막기 위해 Next 버튼(과 스와이프)으로만 넘어가게 유지한다.
tutorialOverlay.addEventListener('click', () => {
  if (isLikelyMobile) return;
  advanceTutorial();
});

// 좌우로 스와이프해도 슬라이드가 넘어가게 한다 (배경을 그냥 탭하는 것과는 구분되도록 이동 거리로 판단).
// 드래그하는 동안 카드 자체가 손가락을 따라 움직여야 "카드가 드래그되고 있다"는 게 눈에 보이므로
// touchmove마다 활성 슬라이드에 translateX를 적용한다.
let tutorialSwipeStartX = null;
let tutorialSwipeSlide = null;
tutorialOverlay.addEventListener('touchstart', (e) => {
  tutorialSwipeStartX = e.touches[0].clientX;
  tutorialSwipeSlide = tutorialSlides[tutorialIndex];
}, { passive: true });
tutorialOverlay.addEventListener('touchmove', (e) => {
  if (tutorialSwipeStartX === null || !tutorialSwipeSlide) return;
  const dx = e.touches[0].clientX - tutorialSwipeStartX;
  tutorialSwipeSlide.style.transform = `translateX(${dx}px)`;
  tutorialSwipeSlide.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / 300));
}, { passive: true });
tutorialOverlay.addEventListener('touchend', (e) => {
  if (tutorialSwipeStartX === null) return;
  const dx = e.changedTouches[0].clientX - tutorialSwipeStartX;
  tutorialSwipeStartX = null;
  if (tutorialSwipeSlide) {
    tutorialSwipeSlide.style.transform = '';
    tutorialSwipeSlide.style.opacity = '';
    tutorialSwipeSlide = null;
  }
  if (Math.abs(dx) < 30) return;
  if (dx < 0) {
    advanceTutorial();
  } else {
    rewindTutorial();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeTutorial();
    setHomeIconsOpacity('1');
  }
});