// 프론트에서 "결제 성공했다"고 보내는 값만 믿으면 개발자도구로 얼마든지
// 우회할 수 있다. 그래서 여기서 포트원 서버에 paymentId로 직접 조회해서
// 상태가 실제로 PAID인지, 금액이 우리가 받아야 할 금액과 일치하는지 재확인한다.
// PORTONE_API_SECRET은 Netlify 대시보드(Site settings > Environment variables)에
// 등록해야 한다 — 절대 코드/저장소에 직접 적지 않는다.
const PAYMENT_AMOUNT = 1000;

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
    const isPaid = data.status === 'PAID' && data.amount && data.amount.total === PAYMENT_AMOUNT;
    return { statusCode: 200, body: JSON.stringify({ ok: isPaid, status: data.status }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: 'Server error' }) };
  }
};
