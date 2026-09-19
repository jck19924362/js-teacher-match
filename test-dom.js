// test-dom.js - jsdom 交互回归（node test-dom.js，需 NODE_PATH 指向 workspace/node_modules）
// 经验：jsdom 不加载 file:// 外链脚本 → 手动内联 data.js/match.js；mock window.confirm
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const dataJs = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8');
const matchJs = fs.readFileSync(path.join(__dirname, 'match.js'), 'utf8');
html = html.replace('<script src="data.js"></script>', '<script>\n' + dataJs + '\n</script>');
html = html.replace('<script src="match.js"></script>', '<script>\n' + matchJs + '\n</script>');

const errors = [];
const errors2 = [];
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'http://localhost:8080/index.html',
  beforeParse(window) {
    window.confirm = () => true;
    window.addEventListener('error', e => errors.push(String(e.message)));
  }
});
const { window } = dom;
const { document } = window;

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name); }
}
function click(el) {
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

// 两个实例都跑完后才退出
let pending = 2;
function finish() {
  pending--;
  if (pending) return;
  console.log(`\nDOM 交互回归: ${pass} PASS / ${fail} FAIL / window错误 ${errors.length + errors2.length}`);
  errors.concat(errors2).forEach(e => console.log('  window错误:', e));
  process.exit(fail || errors.length + errors2.length ? 1 : 0);
}

// —— 独立实例：复现"刷新恢复档案"链路（预置 userProfile，须在 load 前写入）——
const domRestore = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'http://localhost:8080/index.html',
  beforeParse(window) {
    window.confirm = () => true;
    window.localStorage.setItem('userProfile', JSON.stringify({
      graduateYear: "2027", degree: "本科", degreeType: "", schoolType: "双非一本",
      bachelorSchoolType: "", normalMajor: "师范类", specialStatus: [], politicalStatus: "",
      putonghua: "", scholarshipTimes: "", region: "jiangsu", city: "", district: "",
      otherProvince: "", certs: ["小学数学", "初中数学"],
      honors: ["校级优秀毕业生", "优秀团员", "校级二等奖学金"],
      zongce: "", major: "小学教育（数学方向）", majorBachelor: "", otherConditions: ""
    }));
    window.addEventListener('error', e => errors2.push(String(e.message)));
  }
});
domRestore.window.addEventListener('load', () => {
  setTimeout(() => {
    const d = domRestore.window.document;
    console.log('== 刷新恢复档案（回归：normalMajor 丢失 + 专业被改成语文）==');
    t('恢复：normalMajor=师范类', (d.querySelector('input[name="normalMajor"]:checked') || {}).value === '师范类');
    const majorSel = d.querySelector('#major input[name="major"]:checked, #majorXiaoxue input[name="major"]:checked');
    t('恢复：专业=小学教育（数学方向）', !!majorSel && majorSel.value === '小学教育（数学方向）');
    t('恢复：语文未被误勾', !(d.querySelector('input[name="major"][value="语文"]') || {}).checked);
    t('恢复：两本教资保留', d.querySelector('#certsPrimary input[value="小学数学"]').checked && d.querySelector('#certsJunior input[value="初中数学"]').checked);
    t('恢复：三项荣誉保留', d.querySelectorAll('#honors input:checked, #honorsScholarship input:checked').length === 3);
    t('恢复后 matchCount>0', parseInt(d.getElementById('matchCount').textContent, 10) > 0);
    finish();
  }, 150);
});

window.addEventListener('load', () => {
  setTimeout(() => {
    console.log('== 初始渲染 ==');
    // 期望值：从 data.js 源码独立解析（inline script 的 const 不会挂到 window）
    const expectedJobs = new Function(dataJs + ';return JOBS.length;')();
    const expectedCities = new Function(dataJs + ';return new Set(JOBS.map(j=>j.city)).size;')();
    t('头部统计=岗位总数', document.getElementById('statJobs').textContent === String(expectedJobs));
    t('默认小学tab激活', document.querySelector('.stage-tab[data-stage="小学"]').classList.contains('active'));
    t('覆盖地市=实际地市数', document.querySelector('.hero-stats .hero-stat:nth-child(2) .num').textContent === String(expectedCities));
    // 浙江版对齐功能
    t('搜索框存在', !!document.getElementById('resultSearch'));
    t('导出ICS/TXT按钮存在', !!document.querySelector('[data-action="export-fav-ics"]') && !!document.querySelector('[data-action="export-fav-txt"]'));
    t('匹配计数元素存在', !!document.getElementById('matchCount'));
    const searchInput = document.getElementById('resultSearch');
    searchInput.value = '不存在的关键词xyzzy';
    searchInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    const searchBody = document.getElementById('resultArea').textContent;
    t('搜索过滤生效', searchBody.indexOf('没有符合') !== -1 || searchBody.indexOf('暂无') !== -1);
    searchInput.value = '';
    searchInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    const result0 = document.getElementById('resultArea');
    t('初始匹配已渲染', result0 && result0.innerHTML.length > 500);
    t('无内联onclick', !/<[a-z][^>]*onclick=/i.test(document.documentElement.outerHTML));
    t('户籍默认显示江苏省选框', document.getElementById('jiangsuHukouBox').style.display === 'flex');

    console.log('== 学段切换（document 委托）==');
    click(document.querySelector('.stage-tab[data-stage="高中"]'));
    t('高中tab激活', document.querySelector('.stage-tab[data-stage="高中"]').classList.contains('active'));
    t('结果标题切换', document.getElementById('resultTitle').textContent.indexOf('高中') !== -1);
    t('高中教资面板显示', document.querySelector('.cert-stage-box[data-stage="高中"]').style.display === 'block');
    click(document.querySelector('.stage-tab[data-stage="小学"]'));
    t('切回小学', document.querySelector('.stage-tab[data-stage="小学"]').classList.contains('active'));

    console.log('== 勾教资不切学段（回归：closest[data-stage] 曾命中教资面板）==');
    // 复现用户场景：小学 tab 下勾选"初中数学"教资，学段不得被静默切换
    const certJunior = document.querySelector('.cert-stage-box[data-stage="初中"] input[value="初中数学"]');
    certJunior.checked = true;
    click(certJunior);
    t('勾教资后学段tab仍为小学', document.querySelector('.stage-tab[data-stage="小学"]').classList.contains('active'));
    t('勾教资后结果标题仍为小学', document.getElementById('resultTitle').textContent.indexOf('小学') !== -1);
    // 键盘空格勾选同样不得切学段
    certJunior.dispatchEvent(new window.KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    t('空格键勾选后学段仍为小学', document.querySelector('.stage-tab[data-stage="小学"]').classList.contains('active'));
    certJunior.checked = false; // 还原，避免影响后续用例

    console.log('== 专业方向不被学段切换重置（回归：filterMajor 曾误勾语文）==');
    // 复现：选"小学教育（数学方向）"后切走再切回学段，专业不得被静默重置
    const dirRadio = document.querySelector('#majorXiaoxue input[value="小学教育（数学方向）"]');
    dirRadio.checked = true;
    window.switchStage('初中');
    window.switchStage('小学');
    t('切学段往返后方向仍勾选', dirRadio.checked);
    t('切学段往返后语文未被误勾', !document.querySelector('input[name="major"][value="语文"]').checked);
    dirRadio.checked = false; // 还原

    console.log('== 状态筛选 ==');
    click(document.querySelector('[data-filter="no"]'));
    // runMatch 重渲染 → 用实时查询断言（旧元素已脱离 DOM）
    t('不符筛选激活', document.querySelector('[data-filter="no"]').classList.contains('active'));
    const body1 = document.getElementById('resultArea').textContent;
    t('不符视图含子模块', body1.indexOf('条件不符') !== -1 || body1.indexOf('仅届别不符') !== -1 || body1.indexOf('暂无') !== -1);
    click(document.querySelector('[data-filter="ok"]'));
    t('切回可报', document.querySelector('[data-filter="ok"]').classList.contains('active'));

    console.log('== 不符子筛选 ==');
    click(document.querySelector('[data-filter="no"]'));
    const subCohort = document.querySelector('[data-sub-filter="cohort"]');
    if (subCohort) {
      click(subCohort);
      t('子筛选cohort激活', document.querySelector('[data-sub-filter="cohort"]').classList.contains('active'));
      click(document.querySelector('[data-sub-filter="cohort"]')); // 再点取消
      t('子筛选取消回all', !document.querySelector('[data-sub-filter="cohort"]').classList.contains('active'));
    } else {
      console.log('  (无不符子模块，跳过)');
    }
    click(document.querySelector('[data-filter="ok"]'));

    console.log('== 详情弹窗 ==');
    const card = document.querySelector('[data-job-id]');
    t('存在岗位卡片', !!card);
    if (card) {
      click(card);
      t('详情弹窗打开', document.getElementById('detailModal').classList.contains('show'));
      t('弹窗有标题内容', (document.getElementById('modalTitle2').textContent || '').length > 4);
      click(document.querySelector('#detailModal [data-action="close-detail"]'));
      t('关闭按钮关闭弹窗', !document.getElementById('detailModal').classList.contains('show'));
      click(card);
      click(document.getElementById('detailModal')); // 遮罩空白
      t('遮罩空白关闭弹窗', !document.getElementById('detailModal').classList.contains('show'));
    }

    console.log('== 收藏 ==');
    if (card) {
      const favBtn = card.querySelector('[data-fav-toggle]');
      click(favBtn);
      t('收藏后角标=1', document.getElementById('favCount').textContent === '1');
      // runMatch 会重渲染卡片 → 重新查询新元素再点
      const favBtn2 = document.querySelector('[data-job-id] [data-fav-toggle]');
      click(favBtn2);
      t('再点取消收藏', document.getElementById('favCount').textContent === '0');
      click(document.querySelector('[data-job-id] [data-fav-toggle]')); // 重新收藏供时间线测试
    }

    console.log('== 时间线弹窗 ==');
    click(document.querySelector('[data-action="open-timeline"]'));
    t('时间线打开', document.getElementById('timelineModal').classList.contains('show'));
    t('收藏条目渲染', document.querySelectorAll('#favList .fav-item').length === 1);
    const favDel = document.querySelector('#favList [data-fav-del]');
    if (favDel) {
      click(favDel);
      t('时间线内取消收藏', document.querySelectorAll('#favList .fav-item').length === 0);
    }
    click(document.querySelector('#timelineModal [data-action="close-timeline"]'));
    t('时间线关闭', !document.getElementById('timelineModal').classList.contains('show'));

    console.log('== 自定义荣誉 ==');
    const hInput = document.getElementById('customHonorInput');
    hInput.value = '省师范生教学基本功大赛二等奖';
    click(document.querySelector('[data-action="add-custom-honor"]'));
    const tag = document.querySelector('#customHonors [data-honor-del]');
    t('荣誉标签生成', !!tag);
    if (tag) {
      t('标签内容正确', tag.textContent.indexOf('基本功大赛二等奖') !== -1);
      click(tag);
      t('点标签删除荣誉', document.querySelectorAll('#customHonors [data-honor-del]').length === 0);
    }

    console.log('== 户籍联动 ==');
    const regionOther = document.querySelector('input[name="region"][value="other"]');
    regionOther.checked = true;
    click(regionOther); // radio click 触发 change
    regionOther.dispatchEvent(new window.Event('change', { bubbles: true }));
    t('省外显示省份选择', document.getElementById('otherProvinceBox').style.display === 'block');
    const regionJs = document.querySelector('input[name="region"][value="jiangsu"]');
    regionJs.checked = true;
    regionJs.dispatchEvent(new window.Event('change', { bubbles: true }));
    t('切回江苏省', document.getElementById('jiangsuHukouBox').style.display === 'flex');

    console.log(`\n主实例小结: ${pass} PASS / ${fail} FAIL / window错误 ${errors.length}`);
    finish();
  }, 80);
});
