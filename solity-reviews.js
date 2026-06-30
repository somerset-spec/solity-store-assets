/*
 * 솔리티 자사몰 — OSC 자체 리뷰 위젯
 * 카페24 EZ 스마트디자인 상품상세에 임베드.
 *   마운트: <div id="solity-reviews" data-client="{clientId}" data-product="SC400"></div>
 *   data-client = CRM Clients rec-id (테넌트 키, 멀티 클라 리뷰 격리).
 * - PR-A `GET {API_BASE}/api/reviews/{clientId}/{productId}` 호출 → 별점·포토·체험단 라벨·쿠팡 집계 렌더
 * - vanilla JS (카페24 jQuery 충돌 회피, $ 미사용). 상태: 로딩/빈/에러/목록
 * - 가짜 후기 0: 서버가 isDisplayed=true만 반환. 평균=전수(서버 계산). 체험단=협찬 라벨 노출.
 * - ★EZ 모듈은 div를 동적(innerHTML)으로 렌더하므로 DOM ready 후 div polling으로 마운트.
 *   script는 EZ 모듈 밖(layout head/body)에 둬야 실행됨(EZ 모듈 안 script는 innerHTML=미실행).
 * 최종 수정 2026-06-30
 */
(function () {
  'use strict';
  var API_BASE = 'https://marketing.5funnel.com';
  var mount, productId, clientId;

  var S = {
    wrap: 'font-family:Pretendard,sans-serif;color:#1a2233;',
    star: 'color:#ffce4d;letter-spacing:1px;',
    badge: 'font-size:11px;font-weight:700;color:#7a6018;background:#fff3d6;border:1px solid #ffe6a8;border-radius:6px;padding:2px 8px;',
    card: 'background:#fff;border:1px solid #e7ebf3;border-radius:14px;padding:18px;',
    grid: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-top:20px;',
    muted: 'color:#5b6577;font-size:13px;',
  };

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function stars(n) { n = Math.round(n || 0); return '★★★★★☆☆☆☆☆'.slice(5 - Math.min(5, n), 10 - Math.min(5, n)); }

  function render(state, data) {
    if (!mount) return;
    if (state === 'loading') {
      mount.innerHTML = '<div style="' + S.wrap + S.muted + 'padding:24px 0">후기를 불러오는 중…</div>';
      return;
    }
    if (state === 'error') {
      mount.innerHTML = '<div style="' + S.wrap + S.muted + 'padding:24px 0">후기를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>';
      return;
    }
    var reviews = (data && data.reviews) || [];
    var sum = (data && data.summary) || { count: 0, avg: 0, photoCount: 0 };
    var head =
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px">' +
      '<h2 style="font-size:22px;font-weight:800;color:#00112c;margin:0">고객 후기</h2>' +
      '<div style="' + S.muted + '"><span style="' + S.star + 'font-size:16px">' + stars(sum.avg) + '</span> ' +
      '<b style="color:#1a2233">' + (sum.avg ? sum.avg.toFixed(1) : '—') + '</b> · ' + (sum.count || 0) + '건' +
      (sum.photoCount ? ' · 포토 ' + sum.photoCount : '') + '</div></div>' +
      '<p style="' + S.muted + 'margin-top:6px">일부 후기는 쿠팡 실구매 고객 후기를 동의 하에 이관한 것이며, 체험단 후기는 \'체험단 제공\'으로 표시됩니다.</p>';

    if (!reviews.length) {
      mount.innerHTML = '<div style="' + S.wrap + '">' + head +
        '<div style="' + S.muted + 'padding:24px 0">아직 등록된 후기가 없습니다. 첫 후기를 남겨주세요.</div></div>';
      return;
    }
    var cards = reviews.map(function (r) {
      var label = r.displayLabel ? '<span style="' + S.badge + '">' + esc(r.displayLabel) + '</span>' :
        (r.isSponsored ? '<span style="' + S.badge + '">체험단 제공</span>' : '');
      var photo = (r.photos && r.photos[0]) ?
        '<img src="' + esc(r.photos[0]) + '" alt="후기 사진" style="width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:10px;margin-top:12px" loading="lazy"/>' : '';
      var disc = r.isSponsored ? '<div style="' + S.muted + 'margin-top:8px;font-size:11.5px">※ 제품을 무상 제공받아 작성된 후기입니다.</div>' : '';
      return '<div style="' + S.card + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<span style="' + S.star + 'font-size:15px">' + stars(r.rating) + '</span>' + label + '</div>' +
        photo +
        (r.title ? '<div style="font-weight:700;margin-top:12px">' + esc(r.title) + '</div>' : '') +
        '<p style="font-size:14px;line-height:1.6;margin-top:8px">' + esc(r.body) + '</p>' +
        '<div style="' + S.muted + 'margin-top:10px">— ' + esc(r.authorMasked || '구매 고객') + '</div>' +
        disc + '</div>';
    }).join('');
    mount.innerHTML = '<div style="' + S.wrap + '">' + head + '<div style="' + S.grid + '">' + cards + '</div></div>';
  }

  function run() {
    mount = document.getElementById('solity-reviews');
    if (!mount) return false; // EZ 모듈 아직 미렌더 → poll 재시도
    if (mount.getAttribute('data-osc-rendered')) return true; // 중복 실행 방지(script 2개 대비)
    mount.setAttribute('data-osc-rendered', '1');
    productId = mount.getAttribute('data-product') || 'SC400';
    clientId = mount.getAttribute('data-client') || '';
    if (!clientId) { render('error'); return true; }
    render('loading');
    fetch(API_BASE + '/api/reviews/' + encodeURIComponent(clientId) + '/' + encodeURIComponent(productId), { credentials: 'omit' })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (data) { render('list', data); })
      .catch(function () { render('error'); });
    return true;
  }

  // EZ 동적 div 렌더 대기: DOM ready 후 최대 ~12s polling
  var tries = 0;
  function poll() {
    if (run()) return;
    if (++tries < 40) setTimeout(poll, 300);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', poll);
  } else {
    poll();
  }
})();
