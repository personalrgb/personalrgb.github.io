// 프론트에서 "결제 성공했다"고 보내는 값만 믿으면 개발자도구로 얼마든지
// 우회할 수 있다. 그래서 여기서 포트원 서버에 paymentId로 직접 조회해서
// 상태가 실제로 PAID인지, 금액이 우리가 받아야 할 금액과 일치하는지 재확인한다.
// PORTONE_API_SECRET은 Netlify 대시보드(Site settings > Environment variables)에
// 등록해야 한다 — 절대 코드/저장소에 직접 적지 않는다.
// 상품이 기본/스타일링/풀 패키지 세 가지라 가격도 세 가지(payment.html의
// data-amount와 맞춤)다 — 그중 하나와 일치하면 된다.
const VALID_AMOUNTS = [1000, 2000, 2500];
// 금액으로 상품 등급을 판정한다 — 프론트가 "이 등급이다"라고 보내는 값은 절대
// 믿으면 안 되므로(URL만 바꿔서 더 비싼 등급을 공짜로 볼 수 있음), 여기서 실제
// 결제 금액 기준으로만 등급을 돌려준다.
const TIER_BY_AMOUNT = { 1000: 'basic', 2000: 'styling', 2500: 'full' };

// 프로모션: 2026-11-27 ~ 2026-12-27 한 달간 풀 패키지도 1,000원이라 기본
// (1,000원)과 금액이 겹친다. 금액만으론 둘을 구분할 수 없으니, 이 기간
// 1,000원 결제에 한해 포트원에 저장된 실제 주문명으로 풀 패키지인지 확인한다
// (payment.html이 보내는 orderName 그대로 — 금액은 똑같아서 스푸핑해도
// 할인가로 풀 패키지를 받는 것 이상의 손해는 없어 안전하다). 기간이 지나면
// 이 분기가 안 걸려 원래 금액 기준 매핑으로 자동 복귀한다.
const PROMO_FULL_1000_ENDS = new Date('2026-12-27T00:00:00+09:00').getTime();
const PROMO_FULL_ORDER_NAME = '퍼스널 컬러 진단 결과지 + 전체 스타일링 가이드';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, message: 'Method Not Allowed' }) };
  }

  const apiSecret = process.env.PORTONE_API_SECRET;
  if (!apiSecret) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: 'PORTONE_API_SECRET not configured' }) };
  }

  let paymentId;
  try {
    ({ paymentId } = JSON.parse(event.body || '{}'));
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, message: 'Invalid request body' }) };
  }
  if (!paymentId) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, message: 'paymentId is required' }) };
  }

  try {
    const res = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `PortOne ${apiSecret}` },
    });
    if (!res.ok) {
      return { statusCode: 200, body: JSON.stringify({ ok: false, message: 'Payment lookup failed' }) };
    }
    const data = await res.json();
    const isPaid = data.status === 'PAID' && data.amount && VALID_AMOUNTS.includes(data.amount.total);
    let tier = isPaid ? TIER_BY_AMOUNT[data.amount.total] : null;
    if (
      isPaid &&
      data.amount.total === 1000 &&
      Date.now() < PROMO_FULL_1000_ENDS &&
      data.orderName === PROMO_FULL_ORDER_NAME
    ) {
      tier = 'full';
    }
    return { statusCode: 200, body: JSON.stringify({ ok: isPaid, status: data.status, tier }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: 'Server error' }) };
  }
};
