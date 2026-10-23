/*
 * 솔리티 자사몰 — OSC 자체 리뷰 위젯
 * 카페24 EZ 스마트디자인 상품상세에 임베드. Detail 상세설명 하단 + Review 탭 둘 다 마운트(각 div 독립 인스턴스).
 *   마운트: <div id="solity-reviews" data-client="{clientId}" data-product="SC400"></div>
 * - GET {API_BASE}/api/reviews/{clientId}/{productId}?page=N&sort=recent|rating|photo
 * - 정렬 드롭다운 + 더보기 + 탭 카운트 배지. 본문 white-space:pre-line(줄바꿈 보존).
 * 최종 수정 2026-06-30
 */
(function () {
  'use strict';
  var API_BASE = 'https://marketing.5funnel.com';

  // Return & Delivery 4-fold 첫 행(PAYMENT/DELIVERY) 상단 정렬
  // (cafe24 기본은 :first-child만 margin-top:0 → flex 2열에서 첫 행 우측 fold가 30px 밀림)
  try {
    var _gcss = document.createElement('style');
    _gcss.textContent = '#prdInfo .detail_guide .ec-base-fold:nth-child(-n+2){margin-top:0 !important}';
    (document.head || document.documentElement).appendChild(_gcss);
  } catch (e) {}

  var S = {
    wrap: 'font-family:Pretendard,sans-serif;color:#1a2233;',
    star: 'color:#ffce4d;letter-spacing:1px;',
    badge: 'font-size:11px;font-weight:700;color:#7a6018;background:#fff3d6;border:1px solid #ffe6a8;border-radius:6px;padding:2px 8px;',
    card: 'background:#fff;border:1px solid #e7ebf3;border-radius:14px;padding:18px;',
    grid: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-top:20px;',
    muted: 'color:#5b6577;font-size:13px;',
    sel: 'font-family:inherit;font-size:13px;color:#1a2233;border:1px solid #d7deea;border-radius:8px;padding:7px 12px;background:#fff;cursor:pointer;',
    more: 'display:block;margin:24px auto 0;font-family:inherit;font-size:14px;font-weight:700;color:#00112c;background:#fff;border:1px solid #cfd7e6;border-radius:10px;padding:13px 34px;cursor:pointer;',
  };

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function stars(n) { n = Math.round(n || 0); return '★★★★★☆☆☆☆☆'.slice(5 - Math.min(5, n), 10 - Math.min(5, n)); }

  // Marketplace review-event preface: the incentive disclosure must stay, the marketplace name must not (owner, 10-23).
  var EVENT_LINE = /^\s*본 리뷰는[^\n]*리뷰 이벤트에 참여하기 위해 작성한 것입니다\.?\s*/;
  function cleanBody(r) { return (r.body || '').replace(EVENT_LINE, ''); }
  function card(r) {
    // 2026-10-23: no marketplace name on the badge (owner request) — only the sponsored-review disclosure stays
    var label = r.isSponsored ? '<span style="' + S.badge + '">체험단 제공</span>' : '';
    var photo = (r.photos && r.photos[0]) ?
      '<img src="' + esc(r.photos[0]) + '" alt="후기 사진" style="width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:10px;margin-top:12px" loading="lazy"/>' : '';
    var note = r.isSponsored ? '※ 제품을 무상 제공받아 작성된 후기입니다.'
      : EVENT_LINE.test(r.body || '') ? '※ 구매 고객이 캐시 지급 리뷰 이벤트에 참여해 작성한 후기입니다.' : '';
    var disc = note ? '<div style="' + S.muted + 'margin-top:8px;font-size:11.5px">' + note + '</div>' : '';
    return '<div style="' + S.card + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
      '<span style="' + S.star + 'font-size:15px">' + stars(r.rating) + '</span>' + label + '</div>' +
      photo +
      (r.title ? '<div style="font-weight:700;margin-top:12px">' + esc(r.title) + '</div>' : '') +
      '<p style="font-size:14px;line-height:1.65;margin-top:8px;white-space:pre-line;word-break:keep-all">' + esc(cleanBody(r)) + '</p>' +
      '<div style="' + S.muted + 'margin-top:10px">— ' + esc(r.authorMasked || '구매 고객') + '</div>' +
      disc + '</div>';
  }

  // 상품 상세 탭 Review 카운트 배지 갱신 (cafe24 기본 게시판 0 → 위젯 집계)
  function updateTabCount(count) {
    try {
      var links = document.querySelectorAll('a[name="use_review"]');
      for (var i = 0; i < links.length; i++) { var sp = links[i].querySelector('span'); if (sp) sp.textContent = '(' + count + ')'; }
    } catch (e) {}
  }

  // 각 div 독립 위젯 인스턴스 (Detail 하단·Review 탭 동시 마운트)
  function mountWidget(mount) {
    if (mount.getAttribute('data-osc-rendered')) return;
    mount.setAttribute('data-osc-rendered', '1');
    // Detail 탭(prdDetail) 위젯은 "제품 등록 방법" 섹션 다음으로 이동
    // (cafe24 description PUT이 div 위치 변경을 무시 → DOM 이동으로 우회)
    try {
      var pd = mount.closest('#prdDetail');
      if (pd) {
        var secs = pd.querySelectorAll('section');
        for (var k = 0; k < secs.length; k++) {
          if (/제품\s*등록\s*방법/.test(secs[k].textContent)) { secs[k].parentNode.insertBefore(mount, secs[k].nextSibling); break; }
        }
      }
    } catch (e) {}
    var st = { page: 1, sort: 'recent', reviews: [], hasMore: false, summary: { count: 0, avg: 0, photoCount: 0 }, loading: false };
    var productId = mount.getAttribute('data-product') || 'SC400';
    var clientId = mount.getAttribute('data-client') || '';

    function setState(state) {
      if (state === 'loading') { mount.innerHTML = '<div style="' + S.wrap + S.muted + 'padding:24px 0">후기를 불러오는 중…</div>'; return; }
      if (state === 'error') { mount.innerHTML = '<div style="' + S.wrap + S.muted + 'padding:24px 0">후기를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>'; }
    }

    function bindSort() {
      var sel = mount.querySelector('.osc-sort');
      if (sel) sel.onchange = function () { st.sort = this.value; st.page = 1; fetchPage(true); };
    }

    function renderList() {
      var sum = st.summary;
      var sortOpts = [['recent', '최신순'], ['rating', '별점 높은순'], ['photo', '포토 후기순']];
      var optHtml = sortOpts.map(function (o) { return '<option value="' + o[0] + '"' + (st.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
      var head =
        '<div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px">' +
        '<h2 style="font-size:22px;font-weight:800;color:#00112c;margin:0">고객 후기</h2>' +
        '<div style="display:flex;align-items:center;gap:14px">' +
        '<span style="' + S.muted + '"><span style="' + S.star + 'font-size:16px">' + stars(sum.avg) + '</span> ' +
        '<b style="color:#1a2233">' + (sum.avg ? sum.avg.toFixed(1) : '—') + '</b> · ' + (sum.count || 0) + '건' +
        (sum.photoCount ? ' · 포토 ' + sum.photoCount : '') + '</span>' +
        '<select class="osc-sort" style="' + S.sel + '">' + optHtml + '</select>' +
        '</div></div>';

      if (!st.reviews.length) {
        mount.innerHTML = '<div style="' + S.wrap + '">' + head + '<div style="' + S.muted + 'padding:24px 0">아직 등록된 후기가 없습니다.</div></div>';
        bindSort(); return;
      }
      var cards = st.reviews.map(card).join('');
      var more = st.hasMore ? '<button class="osc-more" style="' + S.more + '">후기 더보기 (+)</button>' : '';
      var note = '<div style="' + S.muted + 'font-size:12px;margin-top:14px">※ 솔리티 SC400을 구매한 고객의 후기를 판매처 구분 없이 모아 보여 드립니다.</div>';
      mount.innerHTML = '<div style="' + S.wrap + '">' + head + '<div style="' + S.grid + '">' + cards + '</div>' + more + note + '</div>';
      bindSort();
      var btn = mount.querySelector('.osc-more');
      if (btn) btn.onclick = function () { if (st.loading) return; st.page += 1; fetchPage(false); };
      updateTabCount(sum.count);
    }

    function fetchPage(reset) {
      st.loading = true;
      if (reset) setState('loading');
      fetch(API_BASE + '/api/reviews/' + encodeURIComponent(clientId) + '/' + encodeURIComponent(productId) +
        '?page=' + st.page + '&sort=' + encodeURIComponent(st.sort), { credentials: 'omit' })
        .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
        .then(function (data) {
          st.reviews = reset ? (data.reviews || []) : st.reviews.concat(data.reviews || []);
          st.hasMore = !!data.hasMore;
          st.summary = data.summary || st.summary;
          st.loading = false;
          renderList();
        })
        .catch(function () { st.loading = false; setState('error'); });
    }

    if (!clientId) { setState('error'); return; }
    setState('loading');
    fetchPage(true);
  }

  function run() {
    var els = document.querySelectorAll('[id="solity-reviews"]');
    for (var i = 0; i < els.length; i++) mountWidget(els[i]);
    return els.length > 0;
  }

  // 2026-10-23: rating summary + 3 short reviews right under the product title (reviews used to sit ~50 screens down)
  function mountTopSummary() {
    var heading = document.querySelector('.infoArea .headingArea');
    var src = document.querySelector('[id="solity-reviews"]');
    if (!heading || !src || document.querySelector('.osc-topreview')) return !!heading;
    var box = document.createElement('div');
    box.className = 'osc-topreview';
    box.style.cssText = S.wrap + 'margin:10px 0 14px;opacity:0;transform:translateY(8px);transition:opacity .5s ease,transform .5s ease;';
    heading.parentNode.insertBefore(box, heading.nextSibling);
    var clientId = src.getAttribute('data-client') || '', productId = src.getAttribute('data-product') || 'SC400';
    fetch(API_BASE + '/api/reviews/' + encodeURIComponent(clientId) + '/' + encodeURIComponent(productId) + '?page=1&sort=rating', { credentials: 'omit' })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (data) {
        var sum = data.summary || {};
        if (!sum.count) { box.remove(); return; }
        var picks = (data.reviews || []).filter(function (r) { var n = cleanBody(r).trim().length; return r.rating >= 5 && n >= 20 && n <= 140; }).slice(0, 3);
        var chips = picks.map(function (r) {
          var t = cleanBody(r).trim().replace(/\s+/g, ' ');
          if (t.length > 58) t = t.slice(0, 58) + '…';
          return '<div style="flex:0 0 78%;max-width:260px;scroll-snap-align:start;background:#f7f9fc;border:1px solid #e7ebf3;border-radius:12px;padding:12px 14px">' +
            '<div style="' + S.star + 'font-size:12px">★★★★★</div>' +
            '<div style="font-size:13px;line-height:1.55;margin-top:4px;word-break:keep-all;color:#1a2233">' + esc(t) + '</div></div>';
        }).join('');
        box.innerHTML =
          '<a href="#none" class="osc-topreview-link" style="display:flex;align-items:center;gap:8px;text-decoration:none;color:#1a2233">' +
          '<span style="' + S.star + 'font-size:17px">' + stars(sum.avg) + '</span>' +
          '<b style="font-size:16px">' + Number(sum.avg).toFixed(1) + '</b>' +
          '<span style="font-size:14px;color:#5b6577;text-decoration:underline">구매 후기 ' + Number(sum.count).toLocaleString() + '건</span>' +
          '<span style="font-size:14px;color:#5b6577">›</span></a>' +
          (chips ? '<div style="display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;margin-top:10px;padding-bottom:4px;-webkit-overflow-scrolling:touch">' + chips + '</div>' : '');
        box.querySelector('.osc-topreview-link').onclick = function (e) {
          e.preventDefault();
          var target = document.querySelector('#prdDetail [id="solity-reviews"]') || document.querySelector('[id="solity-reviews"]');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        requestAnimationFrame(function () { box.style.opacity = '1'; box.style.transform = 'none'; });
      })
      .catch(function () { box.remove(); });
    return true;
  }

  // 2026-10-23: internal editor note leaked into the product description — hide it until the description is cleaned
  function hideInternalNotes() {
    try {
      var ps = document.querySelectorAll('#prdDetail p, #prdDetail div, #prdDetail span');
      for (var i = 0; i < ps.length; i++) {
        if (ps[i].children.length === 0 && /Drive 보유 상세|OSC 확정/.test(ps[i].textContent)) ps[i].style.display = 'none';
      }
    } catch (e) {}
  }

  // 2026-10-23: conversion UX layer — benefit lines, Korean tab labels, group-buy countdown, one-shot card fade.
  // Truthful only: every line states a real store fact; the countdown runs to the group-buy end printed on its banner.
  // Group-buy products (product_no → end): no discount coupon ever applies to them (owner rule), so no coupon line.
  var GROUPBUY = { '32': '2026-10-26T23:59:59+09:00' };
  function productNo() {
    var m = location.search.match(/product_no=(\d+)/) || location.pathname.match(/\/(\d+)\/?(?:category|$)/);
    return m ? m[1] : '';
  }
  function injectCss() {
    if (document.getElementById('osc-ux-css')) return;
    var css = document.createElement('style');
    css.id = 'osc-ux-css';
    css.textContent =
      '@keyframes osc-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +
      '.osc-in{animation:osc-in .5s cubic-bezier(.2,.7,.2,1) both}' +
      '.osc-benefits{display:grid;gap:8px;margin:0 0 16px}' +
      '.osc-benefit{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:12px;background:#f4f7ff;font:600 14px/1.4 Pretendard,sans-serif;color:#1a2233;word-break:keep-all}' +
      '.osc-benefit i{font-style:normal;font-size:17px}' +
      '.osc-countdown{margin:0 0 14px;padding:12px 14px;border-radius:12px;background:#00112c;color:#fff;font:700 14px/1.4 Pretendard,sans-serif;display:flex;justify-content:space-between;align-items:center}' +
      '.osc-countdown b{font-variant-numeric:tabular-nums;color:#ffd84d;font-size:16px}' +
      '@media (prefers-reduced-motion:reduce){.osc-in{animation:none}}';
    document.head.appendChild(css);
  }
  function mountBenefits() {
    var after = document.querySelector('.osc-topreview') || document.querySelector('.infoArea .headingArea');
    if (!after || document.querySelector('.osc-benefits')) return !!document.querySelector('.osc-benefits');
    var box = document.createElement('div');
    var end = GROUPBUY[productNo()];
    box.className = 'osc-benefits osc-in';
    box.innerHTML =
      (end ? '' : '<div class="osc-benefit"><i>🎁</i>회원가입하면 바로 쓰는 3,000원 할인 쿠폰</div>') +
      '<div class="osc-benefit"><i>🚚</i>무료배송 · 평일 낮 12시 전 주문 시 당일 출고</div>' +
      '<div class="osc-benefit"><i>🛡️</i>솔리티 공식 인증 판매처 · A/S는 제조사가 직접</div>';
    after.parentNode.insertBefore(box, after.nextSibling);
    if (end && Date.now() < Date.parse(end)) {
      var cd = document.createElement('div');
      cd.className = 'osc-countdown osc-in';
      after.parentNode.insertBefore(cd, box);
      var tick = function () {
        var s = Math.max(0, Math.floor((Date.parse(end) - Date.now()) / 1000));
        var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
        var pad = function (n) { return (n < 10 ? '0' : '') + n; };
        cd.innerHTML = '<span>공구 마감까지</span><b>' + (d ? d + '일 ' : '') + pad(h) + ':' + pad(m) + ':' + pad(x) + '</b>';
        if (s > 0) setTimeout(tick, 1000); else cd.remove();
      };
      tick();
    }
    return true;
  }
  function koreanTabs() {
    var map = { 'Detail': '상세정보', 'Review': '구매후기', 'Q&A': '문의', 'Return & Delivery': '배송·교환' };
    var links = document.querySelectorAll('#tabProduct a');
    for (var i = 0; i < links.length; i++) {
      var a = links[i], num = a.querySelector('span');
      var label = (a.childNodes[0] && a.childNodes[0].nodeType === 3) ? a.childNodes[0] : null;
      if (label && map[label.textContent.trim()]) label.textContent = map[label.textContent.trim()] + ' ';
      if (num) num.style.display = num.textContent.trim() === '0' ? 'none' : '';
    }
  }
  // 10-23 (Esther Mall benchmark): Korean buy buttons, site-wide first-purchase bar (skin already shows the discount %)
  function koreanButtons() {
    var map = { 'BUY IT NOW': '바로구매', 'CART': '장바구니 담기', 'WISH LIST': '찜하기' };
    var els = document.querySelectorAll('#actionBuy, .actionCart, [id^="actionWish"], .xans-product-action button, .xans-product-action a');
    for (var i = 0; i < els.length; i++) {
      var t = els[i].childNodes;
      for (var j = 0; j < t.length; j++) if (t[j].nodeType === 3 && map[t[j].textContent.trim()]) t[j].textContent = map[t[j].textContent.trim()];
    }
  }
  function firstBuyBar() {
    if (GROUPBUY[productNo()] || document.querySelector('.osc-topbar')) return;
    var bar = document.createElement('a');
    bar.className = 'osc-topbar';
    bar.href = '/member/agreement.html';
    bar.style.cssText = 'display:block;background:#00112c;color:#fff;text-align:center;font:600 13px/1.4 Pretendard,sans-serif;padding:10px 16px;text-decoration:none;word-break:keep-all';
    bar.innerHTML = '<span style="color:#ffd84d">첫 구매 3,000원 할인</span> · 회원가입하면 바로 드려요 →';
    document.body.insertBefore(bar, document.body.firstChild);
  }
  // 10-23: scroll-tied reveal on detail blocks removed — owner saw stutter while scrolling
  function uxEnhance() { try { injectCss(); var ok = mountBenefits(); koreanTabs(); koreanButtons(); return ok; } catch (e) { return true; } }

  var tries = 0;
  function poll() { var a = run(); var b = mountTopSummary(); hideInternalNotes(); var c = uxEnhance(); if (a && b && c && document.querySelector('.osc-topreview a')) { koreanTabs(); return; } if (++tries < 40) setTimeout(poll, 300); }

  // cafe24 쇼핑몰 공통 이용안내의 빈 "교환 및 반품 주소 -" 블록 제거 (반품주소 미설정 시 노출되는 placeholder)
  function hideEmptyExchangeAddr() {
    try {
      var strongs = document.querySelectorAll('#prdInfo .detail_guide .info strong');
      for (var i = 0; i < strongs.length; i++) {
        var s = strongs[i];
        if (s.textContent.replace(/\s/g, '') === '교환및반품주소') {
          // 값이 비어("-")있을 때만 제거 — 다음 <strong> 전까지의 텍스트에 주소가 없으면 빈 것
          var scan = s.nextSibling, filled = false;
          while (scan && !(scan.nodeType === 1 && scan.tagName === 'STRONG')) {
            var t = (scan.textContent || '').replace(/[\s\-·]/g, '');
            if (t) { filled = true; break; }
            scan = scan.nextSibling;
          }
          if (!filled) {
            var n = s.nextSibling; s.remove();
            while (n && !(n.nodeType === 1 && n.tagName === 'STRONG')) { var x = n; n = n.nextSibling; if (x.parentNode) x.parentNode.removeChild(x); }
          }
          break;
        }
      }
    } catch (e) {}
  }
  // Return & Delivery(#prdInfo) 상단 조상 .contents의 과도한 margin-top(~230px) 축소
  function fixGuideTopMargin() {
    try {
      var pi = document.querySelector('#prdInfo');
      if (!pi) return;
      var el = pi.parentElement;
      while (el && el !== document.body) {
        if (parseFloat(getComputedStyle(el).marginTop) > 120) { el.style.marginTop = '40px'; return; }
        el = el.parentElement;
      }
    } catch (e) {}
  }
  var et = 0;
  function exchPoll() { hideEmptyExchangeAddr(); fixGuideTopMargin(); if (++et < 30) setTimeout(exchPoll, 400); }

  function boot() { try { firstBuyBar(); } catch (e) {} poll(); exchPoll(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
