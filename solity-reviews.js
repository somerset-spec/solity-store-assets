/*
 * 솔리티 자사몰 — OSC 자체 리뷰 위젯
 * 카페24 EZ 스마트디자인 상품상세 Review 탭에 임베드.
 *   마운트: <div id="solity-reviews" data-client="{clientId}" data-product="SC400"></div>
 *   data-client = CRM Clients rec-id (테넌트 키).
 * - GET {API_BASE}/api/reviews/{clientId}/{productId}?page=N&sort=recent|rating|photo
 * - vanilla JS (jQuery 충돌 회피). 정렬 드롭다운 + 더보기(페이지네이션) + 탭 카운트 배지 + cafe24 기본 게시판 숨김.
 * - 마지막 div 마운트(Detail+Review 둘 다면 Review 우선), EZ 동적 div polling.
 * 최종 수정 2026-06-30
 */
(function () {
  'use strict';
  var API_BASE = 'https://marketing.5funnel.com';
  var mount, productId, clientId;
  var st = { page: 1, sort: 'recent', reviews: [], hasMore: false, summary: { count: 0, avg: 0, photoCount: 0 }, loading: false };

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

  function setState(state) {
    if (!mount) return;
    if (state === 'loading') { mount.innerHTML = '<div style="' + S.wrap + S.muted + 'padding:24px 0">후기를 불러오는 중…</div>'; return; }
    if (state === 'error') { mount.innerHTML = '<div style="' + S.wrap + S.muted + 'padding:24px 0">후기를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>'; return; }
  }

  function card(r) {
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
      '<p style="font-size:14px;line-height:1.65;margin-top:8px;white-space:pre-line;word-break:keep-all">' + esc(r.body) + '</p>' +
      '<div style="' + S.muted + 'margin-top:10px">— ' + esc(r.authorMasked || '구매 고객') + '</div>' +
      disc + '</div>';
  }

  function renderList() {
    if (!mount) return;
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
      '<select id="osc-sort" style="' + S.sel + '">' + optHtml + '</select>' +
      '</div></div>';

    if (!st.reviews.length) {
      mount.innerHTML = '<div style="' + S.wrap + '">' + head + '<div style="' + S.muted + 'padding:24px 0">아직 등록된 후기가 없습니다.</div></div>';
      bindSort();
      return;
    }
    var cards = st.reviews.map(card).join('');
    var more = st.hasMore ? '<button id="osc-more" style="' + S.more + '">후기 더보기 (+)</button>' : '';
    mount.innerHTML = '<div style="' + S.wrap + '">' + head + '<div style="' + S.grid + '">' + cards + '</div>' + more + '</div>';
    bindSort();
    var btn = mount.querySelector('#osc-more');
    if (btn) btn.onclick = function () { if (st.loading) return; st.page += 1; fetchPage(false); };
    updateTabCount(sum.count);
  }

  function bindSort() {
    var sel = mount.querySelector('#osc-sort');
    if (sel) sel.onchange = function () { st.sort = this.value; st.page = 1; fetchPage(true); };
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

  // 상품 상세 탭 Review 카운트 배지 갱신 (cafe24 기본 게시판 0 → 위젯 집계)
  function updateTabCount(count) {
    try {
      var links = document.querySelectorAll('a[name="use_review"]');
      for (var i = 0; i < links.length; i++) { var sp = links[i].querySelector('span'); if (sp) sp.textContent = count; }
    } catch (e) {}
  }

  // cafe24 기본 리뷰 게시판(위젯 div 다음 형제) 숨김
  function hideBoard() {
    try {
      var sib = mount.nextElementSibling;
      while (sib) {
        if (sib.querySelector && (sib.querySelector('.board_title') || sib.className.indexOf('product_review') > -1) || /board_title|product_review|xans-board/.test(sib.className || '')) {
          sib.style.display = 'none';
        }
        sib = sib.nextElementSibling;
      }
    } catch (e) {}
  }

  function run() {
    var els = document.querySelectorAll('[id="solity-reviews"]');
    mount = els.length ? els[els.length - 1] : null;
    if (!mount) return false;
    if (mount.getAttribute('data-osc-rendered')) return true;
    mount.setAttribute('data-osc-rendered', '1');
    productId = mount.getAttribute('data-product') || 'SC400';
    clientId = mount.getAttribute('data-client') || '';
    if (!clientId) { setState('error'); return true; }
    setState('loading');
    fetchPage(true);
    return true;
  }

  var tries = 0;
  function poll() { if (run()) return; if (++tries < 40) setTimeout(poll, 300); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poll);
  else poll();
})();
