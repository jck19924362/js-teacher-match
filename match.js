// match.js - 匹配引擎 V3（江苏）
// 更新：学科匹配（专业 + 教资双通道，考哪门课就要哪门教资）、
//       户籍条款查不到时默认按"需江苏省户籍"处理、履历字段移除
//       江苏荣誉口径：师范生教学基本功大赛 / 三好学生 / 优秀毕业生 / 2次校级一等奖学金

// ========== 学历等级 ==========
const DEGREE_RANK = { '大专': 1, '本科': 2, '硕士': 3, '博士': 4 };

// ========== 江苏省内 市→区县 映射（与 index.html cityDistricts 同步）==========
const CITY_DISTRICTS = {
  "南京": ["玄武区","秦淮区","建邺区","鼓楼区","栖霞区","雨花台区","江宁区","浦口区","六合区","溧水区","高淳区"],
  "无锡": ["梁溪区","锡山区","惠山区","滨湖区","新吴区","江阴市","宜兴市"],
  "徐州": ["鼓楼区","云龙区","贾汪区","泉山区","铜山区","丰县","沛县","睢宁县","新沂市","邳州市"],
  "常州": ["天宁区","钟楼区","新北区","武进区","金坛区","溧阳市"],
  "苏州": ["姑苏区","虎丘区","吴中区","相城区","吴江区","常熟市","张家港市","昆山市","太仓市","工业园区","高新区"],
  "南通": ["崇川区","港闸区","通州区","如东县","启东市","如皋市","海门区","海安市"],
  "连云港": ["连云区","海州区","赣榆区","东海县","灌云县","灌南县"],
  "淮安": ["淮安区","淮阴区","清江浦区","洪泽区","涟水县","盱眙县","金湖县"],
  "盐城": ["亭湖区","盐都区","大丰区","响水县","滨海县","阜宁县","射阳县","建湖县","东台市"],
  "扬州": ["广陵区","邗江区","江都区","宝应县","仪征市","高邮市"],
  "镇江": ["京口区","润州区","丹徒区","丹阳市","扬中市","句容市"],
  "泰州": ["海陵区","高港区","姜堰区","兴化市","靖江市","泰兴市"],
  "宿迁": ["宿城区","宿豫区","沭阳县","泗阳县","泗洪县"]
};
// 反向：区县 → 所属市
const DISTRICT_TO_CITY = {};
for (const [city, districts] of Object.entries(CITY_DISTRICTS)) {
  for (const d of districts) DISTRICT_TO_CITY[d] = city;
}

// ========== 荣誉等级（1~6，数字越大含金量越高） ==========
const HONOR_RANK = {
  // 荣誉称号
  '省级优秀毕业生': 5,
  '校级优秀毕业生': 3.5,
  '省级三好学生': 5,
  '校级三好学生': 3,
  '优秀学生干部': 3,
  '优秀团干部': 3,
  '优秀学生': 3,
  '优秀团员': 2.5,
  // 奖学金（按等级）
  '国家奖学金': 6,
  '国家励志奖学金': 4,
  '省政府奖学金': 5,
  '校级一等奖学金': 4,
  '校级二等奖学金': 3,
  '校级三等奖学金': 2.5,
  '校级单项奖学金': 2,
  // 省级师范生教学基本功大赛（江苏官方竞赛名，按等级）
  '省级师范生教学基本功大赛一等奖': 5,
  '省级师范生教学基本功大赛二等奖': 4.5,
  '省级师范生教学基本功大赛三等奖': 4,
  // 兼容浙江旧称（技能竞赛）
  '省级师范生技能竞赛一等奖': 5,
  '省级师范生技能竞赛二等奖': 4.5,
  '省级师范生技能竞赛三等奖': 4,
  // 学科/教学竞赛
  '全国师范生教学技能竞赛获奖': 5,
  '省级学科竞赛一等奖': 4.5,
  '省级学科竞赛二等奖': 4,
  '省级学科竞赛三等奖': 3.5,
  '高中学科奥赛省级获奖': 4.5,
  '全国大学生竞赛获奖': 4.5,
};

// 自定义荣誉按关键词评估等级
function estimateHonorLevel(name) {
  if (!name) return 0;
  if (/国家奖学金|国奖/.test(name)) return 6;
  if (/省优|省级优秀毕业生/.test(name)) return 5;
  if (/省级[^，。;；]{0,6}三好/.test(name)) return 5;
  if (/三好学生|三好/.test(name)) return 3;
  if (/基本功大赛|基本功竞赛|师范生基本功/.test(name)) {
    if (/一等奖/.test(name)) return 5;
    if (/二等奖/.test(name)) return 4.5;
    if (/三等奖/.test(name)) return 4;
    return 4;
  }
  if (/省师范生技能竞赛|师范生技能赛/.test(name)) {
    if (/一等奖/.test(name)) return 5;
    if (/二等奖/.test(name)) return 4.5;
    if (/三等奖/.test(name)) return 4;
    return 4;
  }
  if (/国家级|全国/.test(name)) return 4.5;
  if (/省级|省 .{0,4}(奖|赛|竞赛|优秀)/.test(name)) return 4.5;
  if (/校优|校级优秀/.test(name)) return 3.5;
  if (/一等奖|金奖/.test(name)) return 4;
  if (/二等奖|银奖/.test(name)) return 3;
  if (/三等奖|铜奖/.test(name)) return 2.5;
  if (/优秀|先进|竞赛|大赛/.test(name)) return 3;
  if (/奖学金/.test(name)) return 3;
  if (/院级|系级/.test(name)) return 2;
  return 2; // 未识别的自定义荣誉默认较低等级，建议人工核实
}

// ========== 资格条款解析引擎（V3.1） ==========
// 提前批的报考资格常为"满足以下条件之一"的多条款 OR 结构（如：
//   "硕士研究生 或 公费师范生 或 双一流本科 或 师范本科+校一等奖学金 或 综测前20%…"）
// 旧版只用一个"荣誉等级阈值"一刀切 → 大量误判为待确认。
// 新版：把门槛文本拆成条款，每条用特征词归类并逐条判定，命中任一即通过。
// profile 新增字段：specialStatus[]（公费师范生/复硕/国优计划/初阳经亨颐/一表特控线）、
//                   politicalStatus（中共党员/预备党员/共青团员）、honors 含学科竞赛/奥赛等。

// 用户档案 → 结构化能力集（供资格判定）
function buildAbilitySet(profile) {
  const degree = profile.degree || '';
  const st = profile.schoolType || '';
  const honors = profile.honors || [];
  const special = profile.specialStatus || [];
  const political = profile.politicalStatus || '';
  const zongce = parseFloat(profile.zongce) || null;
  const normal = profile.normalMajor || '';
  const putonghua = profile.putonghua || '';
  const schTimes = parseInt(profile.scholarshipTimes, 10) || 1;   // 奖学金次数（默认1）
  const H = s => honors.some(h => h && h.indexOf(s) !== -1);   // 荣誉含关键词
  const S = s => special.indexOf(s) !== -1;                     // 特殊身份
  const hasScholarship = H('国家奖学金') || H('国家励志奖学金') || H('省政府奖学金') || H('校级一等奖学金') || H('校级二等奖学金') || H('校级三等奖学金');
  // 院校层次（数值越大层次越高）：985=6, 部属师范=5.5, 211=5, 双一流(非985/211)=4.5,
  //   10所重点师范=4, 省属重点师范=3, 南师大江苏师大=2.5, 双非一本=2, 普通本科=1, 境外=-1单独标记
  function schoolLevel(s) {
    if (!s) return 0;
    if (s.indexOf('985') !== -1) return 6;
    if (s.indexOf('部属师范') !== -1) return 5.5;
    if (s.indexOf('211') !== -1) return 5;
    if (s.indexOf('双一流') !== -1) return 4.5;
    if (s.indexOf('10所重点师范') !== -1) return 4;
    if (s.indexOf('省属重点师范') !== -1) return 3;
    if (s.indexOf('南师大') !== -1 || s.indexOf('江苏师大') !== -1) return 2.5;
    if (s.indexOf('双非一本') !== -1) return 2;
    if (s.indexOf('普通本科') !== -1) return 1;
    if (s.indexOf('境外') !== -1) return -1;   // 境外单列
    return 1;
  }
  const sLevel = schoolLevel(st);
  // 本科院校层次（仅硕士用户有独立的本科；本科用户的本科=主院校）
  const bSt = profile.bachelorSchoolType || st;
  const bLevel = schoolLevel(bSt);
  const ab = {
    inJiangsu: profile.region !== 'other',
    city: profile.city || '',
    district: profile.district || '',
    degreeRank: DEGREE_RANK[degree] || 0,
    isMaster: DEGREE_RANK[degree] >= 3,
    isBachelor: DEGREE_RANK[degree] === 2,
    // 院校层次——主院校（本科用户=本科，硕士用户=硕士）
    school: st,
    schoolLevel: sLevel,
    is985: sLevel >= 6,
    is211: sLevel >= 5,
    isShuangyiliu: sLevel >= 4.5,
    isBushuShifan: st.indexOf('部属师范') !== -1,
    isNanShiDa: st.indexOf('南师大') !== -1 || st.indexOf('江苏师大') !== -1 || st.indexOf('南京师范大学') !== -1 || st.indexOf('江苏师范大学') !== -1,
    isShengzhongdian: st.indexOf('省属重点师范') !== -1,
    is10Shifan: st.indexOf('10所重点师范') !== -1 || st.indexOf('部属师范') !== -1,
    isJingwai: st.indexOf('境外') !== -1,
    // 本科院校层次（仅硕士用户独立；本科用户与主院校一致）
    bachelorSchool: bSt,
    bachelorSchoolLevel: bLevel,
    bIs985: bLevel >= 6,
    bIs211: bLevel >= 5,
    bIsShuangyiliu: bLevel >= 4.5,
    bIsBushuShifan: bSt.indexOf('部属师范') !== -1,
    bIsNanShiDa: bSt.indexOf('南师大') !== -1 || bSt.indexOf('江苏师大') !== -1 || bSt.indexOf('南京师范大学') !== -1 || bSt.indexOf('江苏师范大学') !== -1,
    bIsShengzhongdian: bSt.indexOf('省属重点师范') !== -1,
    bIsJingwai: bSt.indexOf('境外') !== -1,
    isNormal: normal === '师范类',
    // 特殊身份
    isGongfei: S('公费师范生'),
    isFushuo: S('复硕'),
    isGuoyou: S('国优计划'),
    isElite: S('精英班'),
    // 江苏口径：高考一本线/特控线录取（兼容浙江旧值"一段/一表"）
    isYiduan: S('一本或特控线') || S('一表或特控线') || S('一段') || S('特控线'),
    // 政治面貌
    political,
    isParty: political === '中共党员' || political === '预备党员',
    // 普通话：二甲及以上(2)>二乙(1)>其他/未考取(0)；兼容旧值(一甲/一乙/二甲均视为二甲及以上)
    putonghua,
    putonghuaRank: (putonghua === '二甲及以上' || putonghua === '一甲' || putonghua === '一乙' || putonghua === '二甲') ? 2 : putonghua === '二乙' ? 1 : 0,
    // 荣誉
    hasGuojiang: H('国家奖学金') && !H('励志'),   // 国家奖学金（不含励志）
    hasGuoliZhi: H('国家励志奖学金'),
    hasShengzhengFu: H('省政府奖学金'),
    hasSchoolFirst: H('校级一等奖学金'),
    hasSchoolSecond: H('校级二等奖学金'),
    hasSchoolThird: H('校级三等奖学金'),
    hasShengYouni: H('省级优秀毕业生'),
    hasXiaoYouni: H('校级优秀毕业生'),
    hasShengSanhao: H('省级三好学生'),
    hasXiaoSanhao: H('校级三好学生') || H('省级三好学生'),
    // 师范生竞赛：江苏官方名"教学基本功大赛"优先，兼容浙江旧称"技能竞赛"
    hasShengSkill1: H('教学基本功大赛一等奖') || H('基本功大赛一等奖') || H('省级师范生技能竞赛一等奖'),
    hasShengSkill2: H('教学基本功大赛二等奖') || H('基本功大赛二等奖') || H('省级师范生技能竞赛二等奖'),
    hasShengSkill3: H('教学基本功大赛三等奖') || H('基本功大赛三等奖') || H('省级师范生技能竞赛三等奖'),
    hasGuoSkill: H('全国师范生教学技能竞赛获奖') || H('全国师范生技能竞赛'),
    hasXueke1: H('省级学科竞赛一等奖') || H('省学科竞赛一等奖'),
    hasXueke2: H('省级学科竞赛二等奖') || H('省学科竞赛二等奖'),
    hasXueke3: H('省级学科竞赛三等奖') || H('省学科竞赛三等奖'),
    hasAoKe: H('高中学科奥赛省级获奖') || H('奥赛'),
    hasGuoDaSai: H('全国大学生竞赛获奖'),
    // 奖学金次数相关（"两次校级一等/二等及以上"类条款）
    scholarshipTimes: schTimes,
    hasScholarship,
    hasSecondLevelAndAbove: H('国家奖学金') || H('省政府奖学金') || H('校级一等奖学金') || H('校级二等奖学金'),
    hasTwiceScholarship: schTimes >= 2 && hasScholarship,
    // 2次二等及以上：国奖/省政府/校一/校二
    hasTwiceSecondAbove: schTimes >= 2 && (H('国家奖学金') || H('省政府奖学金') || H('校级一等奖学金') || H('校级二等奖学金')),
    // 2次一等及以上（江苏硬门槛，如苏州）：国奖/省政府/校一
    hasTwiceFirstAbove: schTimes >= 2 && (H('国家奖学金') || H('省政府奖学金') || H('校级一等奖学金')),
    zongce,
    // 荣誉最高等级（沿用旧逻辑，作为兜底）
    maxHonor: Math.max(0, honors.map(h => HONOR_RANK[h] || estimateHonorLevel(h))),
  };
  return ab;
}

// 把门槛文本按 OR 拆成条款
// 分隔符：或、；、;、/、、等之一标记；"博士/硕士/双一流本科"中的 / 也是 OR
// 注意保护括号内容：如"研究生(师范或教育类)"、"2022高考特控线(一段)"里的"或"不拆
function splitClauses(text) {
  if (!text) return [];
  const cleaned = text
    .replace(/报考资格须满足之一|须符合下列资格之一|满足以下条件之一|符合下列条件之一|满足其一|之一|等之一|以下资格|资格之一|条件之一/g, ' ')
    .replace(/[（(]\s*[）)]/g, '')
    .trim();
  // 先把括号内容替换成占位符保护起来
  const brackets = [];
  const masked = cleaned.replace(/[（(][^（()）]*[）)]/g, m => { brackets.push(m); return `\u0001${brackets.length - 1}\u0002`; });
  const parts = masked
    .split(/或|；|;|\/|\n|、/)
    .map(s => s.replace(/^[（(]|[）)]$/g, '').trim())
    .filter(s => s.length >= 2 && !/^[和及与]$/.test(s));
  // 还原括号内容
  return parts.map(p => p.replace(/\u0001(\d+)\u0002/g, (_, i) => brackets[parseInt(i, 10)]));
}

// 判定条款内部是否 AND 组合（"师范本科+校级奖学金"、"硕士且本科为师范"、"金华户籍且国内部分高校"）
// 规则：含"且/并/及/同时" → 强制 AND（每段都命中）；含"+" → 有荣誉/排名词时 AND，否则 OR（院校并列）
function clauseHit(clause, ab) {
  if (!clause) return false;
  const c = clause.trim();
  if (!c) return false;

  // 奖学金次数条款优先判定（"两次校级二等及以上奖学金"里的"及"是固定搭配，不是 AND 组合）
  if (/奖学/.test(c) && (/(两次|二次|2次|两[次个]|三次|3次|三[次个])/.test(c))) {
    const n3 = /(三次|3次|三[次个])(?:及以上|以上)?/.test(c);
    if (n3) return ab.scholarshipTimes >= 3 && ab.hasScholarship;
    // 江苏硬门槛："两次校级一等奖学金及以上" → 国奖/省政府/校一 × 2次
    if (/一等/.test(c)) return ab.hasTwiceFirstAbove;
    if (/二等|以上|国家|省/.test(c) && !/三等/.test(c)) return ab.hasTwiceSecondAbove;
    return ab.hasTwiceScholarship;
  }

  // 拆 AND 组合（+ 且 并 及 同时）——先把"及以上/以上"占位保护，防止"及"被误当连词
  const prot = c.replace(/(及以上|以上)/g, '\u0003');
  if (/[+＋且并及]/.test(prot) && !/师范生|技能竞赛|学科竞赛|基本功/.test(prot.replace(/[+＋且并及\u0003]/g, ''))) {
    const parts = prot.split(/[+＋且并及]/).map(s => s.trim()).filter(s => s.length >= 2);
    if (parts.length >= 2) {
      // 还原占位（"X等奖\u0003"→"X等奖及以上"），供 singleClauseHit 识别
      const restore = s => s.replace(/\u0003/g, '及以上').replace(/\u0004/g, '以上');
      const hasStrictAnd = /且|并|及|同时/.test(prot);   // 明确"且/并/及" → AND（占位后"及以上"不再触发）
      const honorLike = p => /奖|荣誉|优|技能|竞赛|基本功|前\s*\d|排名|综合测评|成绩/.test(p);
      const hasHonor = parts.some(honorLike);
      if (hasStrictAnd) {
        // 强制 AND：每段都须命中（院校/户籍/荣誉都算）
        return parts.every(p => singleClauseHit(restore(p), ab) === true);
      } else if (hasHonor) {
        // "+"且含荣誉 → AND
        return parts.every(p => singleClauseHit(restore(p), ab) === true);
      } else {
        // "+"且全院校/户籍类 → OR（"部属师范+省重点师范+南师大"并列）
        return parts.some(p => singleClauseHit(restore(p), ab) === true);
      }
    }
  }
  return singleClauseHit(c, ab);
}

// 单条款判定（不处理 AND 组合）
function singleClauseHit(c, ab) {
  // 去掉条款内对"仅/限/须"的修饰不影响命中（命中即满足该项）
  const any = (pats) => pats.some(p => c.indexOf(p) !== -1);
  // 院校限定词：条款含这些词时，"本科/硕士"应理解为"某类院校的本科/硕士"，走院校判定而非纯学历
  const hasSchoolWord = any(['双一流', '一流大学', '一流学科', '985', '211', '部属师范', '部属师范大学', '教育部直属', '南师大', '南京师范大学', '江苏师大', '江苏师范大学', '苏大', '苏州大学', '扬大', '扬州大学', '通大', '南通大学', '师范', '省属重点', '省重点', '重点建设', '重点师范', '10所', '十所', '名校', 'C9', '九校', '清华', '北大', '境外', '国外', '海外', '留学', '世界前', '世界排名前', '部分高校']);

  // —— 学历条款（纯学历、无院校限定词时才按学历判）——
  if (any(['博士']) && !hasSchoolWord && !any(['本科以下'])) return ab.degreeRank >= 4;
  if (any(['硕士', '研究生']) && !hasSchoolWord && !any(['本科'])) return ab.isMaster;
  if (any(['本科']) && !hasSchoolWord) return ab.isBachelor || ab.isMaster;

  // —— 院校层次条款（注意顺序：先具体后宽泛；含"本科"时优先用本科院校层次）——
  // 判断本条款是否明确指"本科"院校（人才引进常见"本科须为双一流/985/211"）
  const saysBach = any(['本科院校', '本科为', '本科须', '本科学历', '本科毕业于', '本科阶段', '本科学历须', '本科须为']);
  const useBach = saysBach;
  // 取本科/硕士院校层次对应的能力
  const L985 = useBach ? ab.bIs985 : ab.is985;
  const L211 = useBach ? ab.bIs211 : ab.is211;
  const LSYL = useBach ? ab.bIsShuangyiliu : ab.isShuangyiliu;
  const LBushu = useBach ? ab.bIsBushuShifan : ab.isBushuShifan;
  const LNanShi = useBach ? ab.bIsNanShiDa : ab.isNanShiDa;
  const LJingwai = useBach ? ab.bIsJingwai : ab.isJingwai;

  if (any(['清华', '北大', 'C9', '九校联盟'])) return L985 && ab.isBachelor;
  // 精确档位：985 / 211 / 双一流 分开（985 已算 211 和双一流，211 已算双一流）
  if (any(['985'])) return L985;
  if (any(['211'])) return L211;
  if (any(['双一流', '一流大学', '一流学科'])) return LSYL;
  if (any(['部属师范', '部属师范大学', '教育部直属'])) return LBushu;
  if (any(['南师大', '南京师范大学', '江苏师大', '江苏师范大学', '苏大', '苏州大学', '扬大', '扬州大学', '通大', '南通大学'])) return LNanShi;
  if (any(['省属重点师范', '省重点师范', '省属重点建设高校', '重点建设高校'])) return (useBach ? ab.bIsShengzhongdian || ab.bIsNanShiDa : ab.isShengzhongdian || ab.isNanShiDa);
  if (any(['10所师范', '十所师范', '重点师范大学'])) return useBach ? (ab.bachelorSchoolLevel >= 4) : ab.is10Shifan;
  if (any(['境外', '国外', '海外', '留学', '国（境）外', '国境外', '世界前', '世界排名前'])) return LJingwai || ab.isMaster;

  // —— 特殊身份条款 ——
  if (any(['公费师范'])) return ab.isGongfei;
  if (any(['复硕'])) return ab.isFushuo;
  if (any(['国优计划'])) return ab.isGuoyou;
  if (any(['精英班'])) return ab.isElite;
  if (any(['一本线', '一本录取', '一段线', '特控线', '第一批次录取', '一段录取', '特控'])) return ab.isYiduan;

  // —— 政治面貌条款 ——
  if (any(['中共党员', '党员', '预备党员'])) return ab.isParty;
  if (any(['团员'])) return ab.isParty || ab.political === '共青团员';

  // —— 普通话条款 ——
  if (/普通话/.test(c)) {
    if (/一甲|一乙/.test(c)) return ab.putonghuaRank >= 2;
    if (/二甲/.test(c)) return ab.putonghuaRank >= 2;
    if (/二乙/.test(c)) return ab.putonghuaRank >= 1;
    return ab.putonghuaRank >= 2;   // 未写等级按二甲（教师岗通行标准）
  }

  // —— 荣誉条款（奖学金，注意先具体后宽泛）——
  if (any(['国家奖学金']) && !any(['励志'])) return ab.hasGuojiang;
  if (any(['国家励志'])) return ab.hasGuoliZhi;
  if (any(['省政府奖学金', '省奖学金', '省政府奖'])) return ab.hasShengzhengFu || ab.hasGuojiang;
  if (any(['校级一等', '校一等', '一等奖学金']) && !any(['二等', '三等'])) return ab.hasSchoolFirst;
  if (any(['校级二等', '校二等', '二等奖学金', '综合奖学金']) && !any(['一等', '三等'])) return ab.hasSchoolSecond || ab.hasSchoolFirst;
  if (any(['校级三等', '校三等', '三等奖学金']) && !any(['一等', '二等'])) return ab.hasSchoolThird || ab.hasSchoolSecond || ab.hasSchoolFirst;
  if (any(['奖学金'])) return ab.hasGuojiang || ab.hasShengzhengFu || ab.hasSchoolFirst || ab.hasSchoolSecond || ab.hasSchoolThird;

  // —— 荣誉条款（优秀毕业生/三好学生/称号）——
  if (any(['省级优秀毕业生', '省优', '省级优秀'])) return ab.hasShengYouni;
  if (any(['校级优秀毕业生', '校优', '校级优秀'])) return ab.hasXiaoYouni || ab.hasShengYouni;
  // 三好学生：江苏提前批高频条款（如"省级及以上三好学生"）
  // 精确分支在前：限定"省级及以上"的三好/优秀学生条款只认省级三好，防校级荣誉误命中
  if (/省级及以上[^，。;；、]{0,10}(三好|优秀学生)(?!干部)/.test(c)) return ab.hasShengSanhao;
  if (any(['三好学生'])) return ab.hasShengSanhao || ab.hasXiaoSanhao || ab.hasShengYouni || ab.hasXiaoYouni;
  if (any(['优秀学生干部', '优秀团干部', '优秀学生', '优秀团员'])) {
    // 条款带"省级及以上"限定但精确分支未接住（如"省级及以上优秀学生干部"）→ 从严只认省级档
    if (/省级及以上|国家级/.test(c)) return ab.hasShengSanhao;
    return ab.hasShengYouni || ab.hasXiaoYouni || ab.hasSchoolFirst;
  }

  // —— 竞赛条款 ——
  // 基本功大赛"X等奖及以上"兜底（承前省略竞赛名的子条款）
  const jqM = c.match(/(?:基本功|技能竞赛|技能大赛)[^，。;；]{0,14}(一|二|三)等奖\s*(?:及以上|以上)/);
  if (jqM) {
    const lv = jqM[1];
    if (lv === '一') return ab.hasShengSkill1;
    if (lv === '二') return ab.hasShengSkill1 || ab.hasShengSkill2;
    return ab.hasShengSkill1 || ab.hasShengSkill2 || ab.hasShengSkill3;
  }
  // 基本功大赛精确分支（江苏官方竞赛名，先于宽泛分支）
  if (any(['基本功大赛一等奖', '基本功竞赛一等奖', '基本功一等奖', '教学基本功一等奖'])) return ab.hasShengSkill1;
  if (any(['基本功大赛二等奖', '基本功竞赛二等奖', '基本功二等奖', '教学基本功二等奖'])) return ab.hasShengSkill1 || ab.hasShengSkill2;
  if (any(['基本功大赛三等奖', '基本功竞赛三等奖', '基本功三等奖', '教学基本功三等奖', '基本功大赛', '基本功竞赛'])) return ab.hasShengSkill1 || ab.hasShengSkill2 || ab.hasShengSkill3;
  if (any(['师范生技能竞赛一等奖', '师范生技能赛一等奖', '技能大赛一等奖'])) return ab.hasShengSkill1;
  if (any(['师范生技能竞赛二等奖', '师范生技能赛二等奖', '技能大赛二等奖'])) return ab.hasShengSkill1 || ab.hasShengSkill2;
  if (any(['师范生技能竞赛三等奖', '师范生技能赛三等奖', '技能大赛三等奖', '技能竞赛获奖'])) return ab.hasShengSkill1 || ab.hasShengSkill2 || ab.hasShengSkill3;
  if (any(['全国师范生', '国家师范生', '国赛'])) return ab.hasGuoSkill || ab.hasShengSkill1 || ab.hasShengSkill2;
  if (any(['学科竞赛一等奖', '竞赛一等奖'])) return ab.hasXueke1 || ab.hasGuoDaSai;
  if (any(['学科竞赛二等奖', '竞赛二等奖'])) return ab.hasXueke1 || ab.hasXueke2;
  if (any(['学科竞赛三等奖', '竞赛三等奖'])) return ab.hasXueke1 || ab.hasXueke2 || ab.hasXueke3;
  if (any(['奥赛', '学科奥赛'])) return ab.hasAoKe;
  if (any(['技能竞赛', '技能赛', '师范技能'])) return ab.hasShengSkill1 || ab.hasShengSkill2 || ab.hasShengSkill3;
  if (any(['竞赛', '获奖'])) return ab.hasShengSkill1 || ab.hasShengSkill2 || ab.hasShengSkill3 || ab.hasXueke1 || ab.hasXueke2 || ab.hasAoKe || ab.hasGuoDaSai;

  // —— 综测/排名条款（含"南师大江苏师大前50%""江苏户籍前40%"等）——
  const rankM = c.match(/(?:前|排名|综合测评|成绩|综测)[^0-9]{0,8}?(\d{1,2})\s*%/);
  if (rankM) {
    const req = parseInt(rankM[1], 10);
    return !!ab.zongce && ab.zongce <= req;
  }

  // —— 户籍+排名组合（"江苏户籍前40%"：江苏户籍且排名达标）——
  // 注意："生源(可不受专业限制)"是括号豁免说明，不算独立资格条款；仅"江苏户籍/生源"或"XX县户籍"才判
  const hasHukouClause = /户籍|生源/.test(c) && !/可不受|不受专业|放宽/.test(c);
  if (hasHukouClause) {
    // 精确户籍匹配：提取"XX市/县/区户籍"或"XX户籍"的地名，与用户 city/district 比对
    let hukouOK = ab.inJiangsu;   // 未写明地域默认江苏省内
    const mCity = c.match(/([\u4e00-\u9fa5]{2,5}?市)户籍/);
    const mDistrict = c.match(/([\u4e00-\u9fa5]{2,5}?[县区])户籍/);
    const mPlain = c.match(/([\u4e00-\u9fa5]{2,5}?)户籍/);   // "吴江户籍"无后缀
    if (mCity) {
      hukouOK = ab.city === mCity[1];
    } else if (mDistrict) {
      hukouOK = ab.district === mDistrict[1];
    } else if (mPlain) {
      const place = mPlain[1];
      if (place === '江苏' || place === '江苏省') hukouOK = ab.inJiangsu;
      else hukouOK = ab.district.indexOf(place) !== -1 || ab.city.indexOf(place) !== -1;
    } else if (/江苏省|江苏/.test(c)) {
      hukouOK = ab.inJiangsu;
    }
    if (rankM) {
      const req = parseInt(rankM[1], 10);
      return !!ab.zongce && ab.zongce <= req && hukouOK;
    }
    return hukouOK;
  }

  // —— 师范类要求 ——
  if (any(['师范专业', '师范类', '师范院校'])) {
    if (any(['非师范'])) return true;   // "非师范可报"直接过
    return ab.isNormal;
  }

  // 无法识别的条款 → null（交给调用方决定）
  return null;
}

// 主判定：gate 文本（可能是 honorGate/schoolGate/condition）是否被用户命中
// 返回 { hit: bool|null, clauses: [{t, hit, reason}] }
function evalGate(gate, ab) {
  if (!gate) return { hit: true, clauses: [] };
  // 限定词传播：OR 拆分会丢共享限定词（"省级及以上三好学生或优秀学生(干部)称号"拆开后
  // 第二条款丢掉"省级及以上"→ 校级荣誉被误判满足省级条款），拆分前先补全
  const spread = String(gate).replace(
    /(省级|校级|市级|国家级)及以上([^，。;；、]{1,20}?)或([^，。;；、]{1,20}?)(称号|奖学金|奖项|证书)/g,
    (m, lv, a, b, suf) => `${lv}及以上${a}或${lv}${b}${suf}`
  );
  const clauses = splitClauses(spread);
  if (!clauses.length) return { hit: null, clauses: [] };
  const checked = [];
  let anyHit = false, anyUnknown = false;
  for (const cl of clauses) {
    const r = clauseHit(cl, ab);
    checked.push({ t: cl, hit: r });
    if (r === true) anyHit = true;
    if (r === null) anyUnknown = true;
  }
  // 命中任一 → 通过；无命中但有无法识别的条款 → 不确定；全部明确未中 → 不通过
  return { hit: anyHit ? true : (anyUnknown ? null : false), clauses: checked };
}

// 学科词表：长词在前，避免 "历史与社会" 被同时计入 "历史"
const SUBJECT_WORDS = [
  "历史与社会", "道德与法治", "思想政治", "信息技术", "心理健康", "特殊教育", "学前教育", "社会法治", "社政",
  "语文", "数学", "英语", "科学", "物理", "化学", "生物", "历史", "地理", "政治", "体育", "音乐", "美术", "全科"
];

// 学段写法 → 该写法覆盖的学段集合（公告常混用「中学/中小学/普高/职高」）
const STAGE_ALIAS = {
  "幼儿园": ["幼儿园"], "幼儿": ["幼儿园"], "学前": ["幼儿园"],
  "小学": ["小学"],
  "初中": ["初中"],
  "高中": ["高中"], "普高": ["高中"], "职高": ["高中"],
  "中学": ["初中", "高中"],          // 未指明初/高中时，两个学段都算
  "中小学": ["小学", "初中"]
};

// 判断一个片段归属哪个学段：复合词「中小学」优先，具体学段次之，最后才用泛化的「中学」
function detectStage(text) {
  const t = String(text || "");
  if (t.indexOf("中小学") !== -1) return STAGE_ALIAS["中小学"];
  for (const k of ["幼儿园", "学前", "初中", "高中", "普高", "职高", "小学", "幼儿"]) {
    if (t.indexOf(k) !== -1) return STAGE_ALIAS[k];
  }
  if (t.indexOf("中学") !== -1) return STAGE_ALIAS["中学"];
  return null;
}

// 从文本中抽取学科（命中长词后挖除，避免短词重复计入）
function pickSubjects(text) {
  let rest = String(text || "");
  const out = [];
  for (const w of SUBJECT_WORDS) {
    if (rest.indexOf(w) !== -1) {
      out.push(w);
      rest = rest.split(w).join(" ");
    }
  }
  return out;
}

// 按学段拆分岗位实际招聘的学科。公告 count/posts 文本常见 3 种写法：
//   A 学段块： "小学岗：语文28、数学22、英语8；初中岗：…"      → 整块归属该学段
//   B 逐条前缀："小学语文15、数学8、英语5"（后续项省略前缀）    → 前缀继承
//   C 否定语：  "无小学数学岗" / "不招小学语文"                → 该学科本学段明确不招
// 返回 { subjects, negated, reliable, complete }
//   complete=true 表示公告已把各学段学科完整枚举（无「等/约/其余/详见附件」），可据此直接判不符
function getStageSubjects(job, stage) {
  const rawCount = job.count || "";
  const raw = (rawCount + "\n" + (job.posts || "")).replace(/\n/g, "、");
  const negated = new Set();
  const found = new Set();
  let sawStage = false;

  // ① 先摘掉显式否定语，避免 "无小学数学岗" 被当成正面匹配
  const NEG_RE = /(无|不招|不设|不含|没有|非)\s*(小学|初中|高中|幼儿园|学前|中小学|中学)\s*([^、。；;（()\n，,]{0,10})/g;
  const cleaned = raw.replace(NEG_RE, (m, neg, st, tail) => {
    if ((STAGE_ALIAS[st] || []).indexOf(stage) !== -1) {
      sawStage = true;
      pickSubjects(tail).forEach(s => negated.add(s));
    }
    return " ";
  });

  // ② 统一扫描：按分隔符切项；带学段标记的项更新归属，未标记的项继承上一项归属。
  //    （这样 "小学语文15、数学8、英语5" 里的数学/英语才不会漏；"高中美术、中学数学" 也能各归其位）
  const items = cleaned.split(/[；;。、，,（()\/|\n]+/);
  let cur = null;
  for (const it of items) {
    const t = String(it || "").trim();
    if (!t) continue;
    const st = detectStage(t);
    if (st) { cur = st; sawStage = true; }
    if (!cur || cur.indexOf(stage) === -1) continue;
    pickSubjects(t).forEach(s => found.add(s));
  }

  const subjects = Array.from(found).filter(s => !negated.has(s));
  // 枚举是否完整：出现「等/约/其余/部分/详见/待查/附件」说明只是摘要，不能据此判不符
  const complete = !/(等|约|其余|其它|其他学科|部分|详见|待查|待定|见附件|查附件|见岗位表|详见岗位表|学科待查)/.test(rawCount);
  return {
    subjects,
    negated: Array.from(negated),
    reliable: sawStage && subjects.length > 0,
    complete: complete
  };
}

// 岗位荣誉门槛的等级要求（注意先匹配更具体的写法）
function honorRequirementLevel(gate) {
  if (!gate) return 0;
  if (/国奖|国家奖学金/.test(gate)) return 6;
  if (/基本功大赛|基本功竞赛|师范生基本功|省师范生技能竞赛|省师范生技能赛|师范生技能赛/.test(gate)) {
    if (/一等奖/.test(gate)) return 5;
    if (/二等奖/.test(gate)) return 4.5;
    if (/三等奖/.test(gate)) return 4;
    return 4;
  }
  if (/省优|省级优秀毕业生/.test(gate)) return 5;
  if (/省级|国家|全国/.test(gate)) return 5;
  if (/校一等/.test(gate)) return 4;
  if (/校二等|校综二等|综合奖学金/.test(gate)) return 3;
  if (/院级/.test(gate)) return 2;
  if (/校级|荣誉|获奖|奖学金/.test(gate)) return 3;
  return 3;
}

// 岗位是否提供"成绩/综测/排名前X%"的替代通道（有则返回百分比如30）
function rankAlternativePercent(job) {
  const text = (job.honorGate || '') + ' ' + (job.condition || '');
  const m = text.match(/(?:成绩|排名|综测|综合测评)[^%。；;]{0,10}?前\s*(\d{1,2})\s*%/);
  return m ? parseInt(m[1], 10) : null;
}

// 从公告文本中解析最晚一个日期（用于推断届别/时间线排序）
function parseLatestDate(text) {
  const re = /(\d{4})年(\d{1,2})月(\d{1,2})日/g;
  const dates = [];
  let m;
  while ((m = re.exec(text || '')) !== null) {
    dates.push(new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)));
  }
  if (!dates.length) return null;
  // 跨年修正：后一个日期早于前一个，说明跨年了
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] < dates[i - 1]) {
      dates[i] = new Date(dates[i].getFullYear() + 1, dates[i].getMonth(), dates[i].getDate());
    }
  }
  return dates.reduce((a, b) => (b > a ? b : a));
}

// 从公告标题+条件里识别面向的届别（如"2026届""2024-2026届"），识别不到按报名日期推断
function jobTargetYears(job) {
  // 1. 显式 year 字段
  if (job.year) return [job.year];
  // 2. 标题/条件中的届别（支持范围）
  const text = (job.title || '') + ' ' + (job.condition || '');
  const years = new Set();
  const range = text.match(/(20(2[4-9]))\s*[-—~至]\s*(20(2[4-9]))\s*届/);
  if (range) {
    for (let y = parseInt(range[1], 10); y <= parseInt(range[3], 10); y++) years.add(y);
  }
  (text.match(/20(2[4-9])届/g) || []).forEach(s => years.add(parseInt(s, 10)));
  if (years.size) return Array.from(years).sort((a, b) => a - b);
  // 3. 按报名日期推断：2026年9月1日前为 2026 届，及以后为 2027 届
  const d = parseLatestDate(job.enroll);
  if (d) {
    const cutoff = new Date(2026, 8, 1); // 2026-09-01
    return [d < cutoff ? 2026 : 2027];
  }
  // 4. 默认
  return [2026];
}

// 岗位招聘届别：取 jobTargetYears 中最大一年
function jobYear(job) {
  if (job.year) return job.year;
  const ys = jobTargetYears(job);
  if (ys && ys.length) return Math.max(...ys);
  return 2026;
}

// 教资等级：幼儿园=1 小学=1 初中=2 高中=3
function certStage(name) {
  if (!name) return 0;
  if (name.startsWith('幼儿园')) return 1;
  if (name.startsWith('小学')) return 1;
  if (name.startsWith('初中')) return 2;
  if (name.startsWith('高中')) return 3;
  return 1;
}

const CERT_LEVEL_REQ = { primary: 1, junior: 2, senior: 3 };
const STAGE_CERT_LEVEL = { '幼儿园': 1, '小学': 1, '初中': 2, '高中': 3 };

// 专业名 → 学科方向归一化（"小学教育（数学方向）"→"数学"）
function normalizeSubject(text) {
  if (!text) return '';
  // 特殊教育优先：教育康复学、康复治疗学等虽带"教育/治疗"字样但属特教方向
  if (/特殊教育|教育康复|康复治疗|社区康复|儿童康复|康复医学|言语听觉|听力学|培智|盲文|自闭症|智障|残障/.test(text)) return '特殊教育';
  if (/数学/.test(text)) return '数学';
  if (/语文|中文|汉语言|新闻传播|中国语言/.test(text)) return '语文';
  if (/英语/.test(text)) return '英语';
  if (/物理|化学|生物|科学/.test(text)) return '科学';
  if (/历史与社会|社会科/.test(text)) return '历史与社会';
  if (/历史/.test(text)) return '历史';
  if (/思想政治|政治学|思政|思想品德/.test(text)) return '道德与法治';
  if (/地理/.test(text)) return '地理';
  if (/体育/.test(text)) return '体育';
  if (/音乐/.test(text)) return '音乐';
  if (/美术|艺术|绘画|设计/.test(text)) return '美术';
  if (/通用技术/.test(text)) return '通用技术';
  if (/信息|计算机|软件/.test(text)) return '信息技术';
  if (/学前/.test(text)) return '学前教育';
  if (/心理/.test(text)) return '心理健康';
  // 教育学大类（小学教育/初等教育）无法定位学科，交给教资通道判断
  if (/教育学|小学教育|初等教育/.test(text)) return '';
  return '';
}

// 学科可通融关系（江苏实际招聘口径）
// 例：持"历史"或"地理"教资通常也能报初中"历史与社会"岗；特教岗常接受心理/学前背景
const SUBJECT_EQUIV = {
  '历史与社会': ['历史与社会', '历史', '地理', '道德与法治'],
  '历史': ['历史', '历史与社会'],
  '地理': ['地理', '历史与社会'],
  '科学': ['科学', '物理', '化学', '生物'],
  '物理': ['物理', '科学'],
  '化学': ['化学', '科学'],
  '生物': ['生物', '科学'],
  '道德与法治': ['道德与法治', '思想政治', '政治'],
  '思想政治': ['思想政治', '道德与法治'],
  // 特教岗专业口径宽：接受心理学类、教育康复学等（2026年江苏各地公告通行做法）
  '特殊教育': ['特殊教育', '心理健康'],
  '心理健康': ['心理健康', '特殊教育'],
  // 通用技术与信息技术同属技术类，江苏招聘常合并招聘/互通
  '通用技术': ['通用技术', '信息技术'],
  '信息技术': ['信息技术', '通用技术'],
};
function expandSubjects(set) {
  const out = new Set();
  set.forEach(s => {
    out.add(s);
    (SUBJECT_EQUIV[s] || []).forEach(x => out.add(x));
  });
  return out;
}

function normalizeJob(job) {
  const r = job.rules || {};
  let hukouText = '不限';
  if (r.hukou === 'none') hukouText = '不限';
  else if (r.hukou === 'jiangsu') hukouText = '江苏省';
  else if (r.hukou === 'unknown') hukouText = '江苏省（默认）';
  else if (r.hukou) {
    // 防御：拼音/非中文值显示成「江苏省」而非裸拼音字符串
    if (!/[\u4e00-\u9fa5]/.test(r.hukou)) hukouText = '江苏省（默认值异常）';
    else if (/^不限/.test(r.hukou)) hukouText = '不限';
    else hukouText = r.hukou;
  }

  let certText = '不限';
  if (r.certLevel === 'none') certText = '应届可后补';
  else if (r.certLevel === 'any') certText = '相应学科教资';
  else if (r.certLevel === 'primary') certText = '小学及以上教资';
  else if (r.certLevel === 'junior') certText = '初中及以上教资';
  else if (r.certLevel === 'senior') certText = '高中教资';
  else if (r.certLevel === 'unknown') certText = '待核实';

  // subjects 防御：江苏公告常给字符串（"语文/数学/英语…多学科"），归一为数组
  let subjArr = [];
  if (Array.isArray(r.subjects)) subjArr = r.subjects;
  else if (typeof r.subjects === 'string' && r.subjects.length) {
    subjArr = r.subjects.split(/[\/、，,\s]+/).map(s => s.trim()).filter(Boolean);
  }

  return {
    ...job,
    hukouText,
    // count/posts 源头归一为字符串（部分公告数据是数字，防下游 .match 崩溃）
    count: String(job.count == null ? '' : job.count),
    posts: String(job.posts == null ? '' : job.posts),
    subjects: subjArr,
    needMaster: !!r.needMaster,
    schoolGate: r.schoolGate || null,
    normalMajor: !!r.normalMajor,
    honorGate: r.honorGate || null,
    certText,
    certLevelReq: r.certLevel || 'none',
    audience: r.audience || 'fresh',
    year: jobYear(job),
    stage: r.stage || job.stage || '小学',
  };
}

/**
 * 匹配主函数
 * profile: { graduateYear: '2026'|'2027'|'other'|'',
 *            region: 'jiangsu'|'other', city, district, otherProvince,
 *            degree: '本科'|'硕士', schoolType, normalMajor: '师范类'|'非师范类'|'',
 *            major: 专业名（归一化出学科方向）,
 *            certs: [], honors: [] (含自定义), zongce: '5'|'10'|'20'|'30'|'50'|'',
 *            otherConditions: 选填文本 }
 * jobs: JOBS 数组
 * options: { stage: '小学'|'初中'|'高中'|'幼儿园', bianzhiOnly: bool }
 */
function matchJobs(profile, jobs, options) {
  if (!profile || !Array.isArray(jobs)) return [];
  options = options || { stage: '小学', bianzhiOnly: false };

  const inJiangsu = profile.region !== 'other';
  const userCity = profile.city || '';
  const userDistrict = profile.district || '';
  const userHonors = profile.honors || [];
  const userCerts = profile.certs || [];
  const degreeRank = DEGREE_RANK[profile.degree] || 0;
  const isGrad = /^\d{4}$/.test(profile.graduateYear || '');
  const userYear = isGrad ? parseInt(profile.graduateYear, 10) : null;
  const zongce = parseFloat(profile.zongce) || null;
  const stage = options.stage;
  const majorSubject = normalizeSubject(profile.major || '');
  // 本硕双专业：硕士用户可填本科专业，两者都参与学科判定（部分地区看本硕是否一致）
  const majorBachelorSubject = normalizeSubject(profile.majorBachelor || '');
  const majorSubjects = new Set([majorSubject, majorBachelorSubject].filter(Boolean));

  // 用户各学科教资的最高学段（{ '数学': 2 } 表示持有初中数学教资）
  const certSubjects = {};
  userCerts.forEach(c => {
    const subj = c.replace(/^(幼儿园|小学|初中|高中)/, '') || '全科';
    const lv = certStage(c);
    if (!certSubjects[subj] || certSubjects[subj] < lv) certSubjects[subj] = lv;
  });
  const userMaxCertLevel = Math.max(0, ...Object.values(certSubjects));

  // 用户可报学科集合（教资学科 ∪ 专业学科），再按江苏口径展开可通融学科
  const userSubjectsRaw = new Set(Object.keys(certSubjects));
  if (majorSubject) userSubjectsRaw.add(majorSubject);
  const userSubjects = expandSubjects(userSubjectsRaw);

  return jobs.map(rawJob => {
    const j = normalizeJob(rawJob);
    let score = 0;
    const reasons = [];  // 硬性不符
    const risks = [];    // 需人工核实（待确认）
    const notes = [];    // 参考提示（不影响档位）
    let cohortMismatch = false; // 公告面向届别早于用户届别（仅届别不符）
    // （届别不匹配的岗位直接按"不符"处理，不再单独标记"已结束"）
    // OR型资格岗（如提前批"满足12条之一即可"）：院校/荣誉门槛不匹配时降级为待确认而非不符
    const softGate = !!(j.rules && j.rules.softGate);
    const gatePush = msg => { (softGate ? risks : reasons).push(msg); };

    // 0. 学段过滤（"中学"同时覆盖初中和高中两个tab）
    const stageOK = j.stage.includes(stage)
      || (j.stage.includes('中学') && (stage === '初中' || stage === '高中'));
    if (!stageOK) {
      return null;
    }

    // 1. 编制筛选
    const staffing = (j.staffing || '') + (j.batch || '');
    const isBianzhi = /事业编|备案|员额|在编|全额/.test(staffing);
    const isNonBianzhi = /派遣|合同制|非编|储备|劳动合同|编外/.test(staffing);
    if (options.bianzhiOnly && (isNonBianzhi || !isBianzhi)) {
      return null;
    }
    if (isBianzhi) score += 10;

    // 2. 面向人群（仅在职 vs 应届）
    if (j.audience === 'in-service') {
      reasons.push('仅面向在职在编教师（选调/选聘）');
    }

    // 3. 届别
    const targetYears = jobTargetYears(j);
    const allowsPast = /历届|往届|社会人员|社会考生/.test((j.condition || '') + (j.title || ''));
    if (targetYears && targetYears.length) {
      const label = targetYears.join('/');
      if (userYear !== null) {
        if (targetYears.includes(userYear)) {
          score += 5;
        } else if (userYear < Math.min(...targetYears)) {
          // 用户在公告面向的届别之前已毕业（往届身份）
          if (allowsPast) {
            score += 5;
          } else {
            reasons.push(`公告面向${label}届应届毕业生，往届生不可报`);
          }
        } else {
          // 用户届别晚于公告面向届别（公告面向更早届别）
          cohortMismatch = true;
          reasons.push(`公告面向${label}届，你的届别为${userYear}届，届别不匹配`);
        }
      } else if (profile.graduateYear === 'other') {
        if (allowsPast) score += 5;
        else risks.push(`公告面向${label}届，往届生需电话确认是否可报`);
      }
    }

    // 4. 户籍（条款查不到 → 默认按"需江苏省户籍"处理）
    const phdRelax = degreeRank === 4 && /博士/.test((j.condition || '') + (j.title || ''));
    const hk = j.hukouText;
    if (hk === '不限') {
      score += 30;
    } else if (hk === '江苏省（默认）') {
      if (inJiangsu) {
        score += 25;
        risks.push('户籍条款未查到，默认按需江苏省户籍处理，请以原公告核实');
      } else {
        reasons.push('户籍条款未查到，默认需江苏省户籍（省外户籍大概率不可报，请核实）');
      }
    } else if (hk === '江苏省') {
      if (inJiangsu) {
        score += 30;
      } else if (phdRelax) {
        score += 25;
        risks.push('公告提及博士可放宽户籍限制，请查看原文确认');
      } else {
        reasons.push('限江苏省户籍/生源');
      }
    } else {
      // 具体市/区县限制 —— 用 CITY_DISTRICTS / DISTRICT_TO_CITY 做精确归属判定
      // 规则：hk 形如"宁波市" → 用户 city 命中即合规；hk 形如"海曙区" → 用户 district 命中即合规；若用户在同市但选错/未选具体区 → 待确认
      let districtHit = false;   // 用户精确命中岗位要求的区/县
      let cityHit = false;       // 用户精确命中岗位要求的市
      let cityCovers = false;    // 岗位限某区，用户在同市但未选该区
      const hkDistricts = [];    // hk 中识别到的区县级名字
      for (const [city, dists] of Object.entries(CITY_DISTRICTS)) {
        if (hk === city) cityHit = userCity === city;
        for (const d of dists) {
          if (hk.includes(d)) {
            hkDistricts.push(d);
            if (userDistrict === d) districtHit = true;
            else if (DISTRICT_TO_CITY[userDistrict] === city) cityCovers = true;
          }
        }
      }
      // hk 不在字典里（罕见旧值或拼音残留）：fallback 用 includes
      if (hkDistricts.length === 0 && !cityHit) {
        if (userDistrict && hk.includes(userDistrict)) districtHit = true;
        else if (userCity && hk.includes(userCity)) cityHit = true;
      }

      if (districtHit || cityHit) {
        score += 30;
      } else if (cityCovers) {
        score += 25;
        risks.push(`户籍要求${hk}，需确认你的区县是否在范围内`);
      } else if (phdRelax) {
        score += 25;
        risks.push(`户籍要求${hk}，公告提及博士可放宽，请查看原文确认`);
      } else {
        // hukou 原文常已是完整表述（"限苏州市吴江区户籍"/"定向（宜兴籍…）"），避免"限限…户籍户籍"双重包装
        reasons.push(/限|户籍|生源|定向|籍/.test(hk) ? hk : `限${hk}户籍/生源`);
      }
    }

    // 5. 学历（支持按学段 + 按学科细分：degreeByStage 优先于 needMaster）
    //   例：高中数学岗硕士起 → degreeByStage:{高中:"硕士"}
    //       小学英语限硕士 → degreeByStage:{"英语-小学":"硕士"}（学科-学段组合键，优先于纯学段键）
    const dbs = (j.rules && j.rules.degreeByStage) || {};
    // 用户实际报考的学科方向（专业归一化 + 教资学科），用于匹配"学科-学段"键
    const userMajorSubj = majorSubject || (userCerts[0] ? userCerts[0].replace(/^(幼儿园|小学|初中|高中)/, '') : '');
    // 判定顺序：学科-学段 精确键 > 纯学段键 > needMaster
    const needMasterBySubject = dbs[userMajorSubj + '-' + stage] === '硕士' || dbs[userMajorSubj + '·' + stage] === '硕士';
    const needMasterNow = needMasterBySubject ? true : (dbs[stage] === '硕士' ? true : j.needMaster);
    if (needMasterNow) {
      if (degreeRank >= 3) score += 20;
      else reasons.push(needMasterBySubject ? `要求硕士研究生及以上（${stage}段${userMajorSubj}岗）` : '要求硕士研究生及以上（' + stage + '段）');
    } else if (degreeRank >= 2) {
      score += 20;
    } else if (degreeRank === 1) {
      // 专科学历：数据库公告均未明确写"大专可报"，一律提示核实
      score += 10;
      risks.push('公告未明确专科学历可报，请电话确认是否放宽至大专');
    } else {
      score += 20; // 未填学历，先按满足处理
    }

    // 5.1 硕士类型（学硕/专硕）偏好：仅对明确标注 needMasterType 的岗位生效，其余岗位不受影响
    const needMt = j.rules && j.rules.needMasterType;
    if (needMt && profile.degree === '硕士') {
      if (!profile.degreeType) {
        risks.push(`岗位偏好${needMt}（学硕/专硕），请确认你的硕士类型是否符合`);
      } else if (profile.degreeType !== needMt) {
        risks.push(`岗位要求${needMt}，你的硕士类型为${profile.degreeType}，能否报考请电话确认`);
      }
    }

    // 6. 资格条款判定（提前批"满足之一"OR 结构）：院校门槛+荣誉门槛合并解析
    // 用结构化档案逐条比对；命中任一条款即通过，避免一刀切待确认
    const ability = buildAbilitySet(profile);
    const gateText = [j.schoolGate, j.honorGate].filter(Boolean).join(' ');
    const isUnknownGate = /unknown/i.test([j.schoolGate, j.honorGate].filter(Boolean).join(' '));
    let gateEval = null, gateHitText = '';
    if (gateText.trim() && !isUnknownGate) {
      gateEval = evalGate(gateText, ability);
      if (gateEval.hit === true) {
        score += 15;
        const hitClause = (gateEval.clauses.find(c => c.hit === true) || {}).t || '';
        gateHitText = hitClause;
        notes.push(`资格已达标：${hitClause}`);
      } else if (gateEval.hit === null) {
        // 部分条款无法识别 → 待确认（不判死）
        score += 7;
        risks.push(`报考资格（${gateText.slice(0, 60)}…）部分条款需人工核对，建议对照公告确认`);
      } else {
        // 全部明确未命中
        gatePush(`报考资格：${gateText.slice(0, 80)}`);
      }
    } else if (j.schoolGate || (j.honorGate && j.honorGate !== 'unknown')) {
      // 纯院校门槛（无荣誉条款）或纯荣誉门槛（无院校条款）分别处理
      const sg = j.schoolGate ? evalGate(j.schoolGate, ability) : null;
      const hg = j.honorGate && j.honorGate !== 'unknown' ? evalGate(j.honorGate, ability) : null;
      const results = [sg, hg].filter(Boolean);
      if (results.some(r => r.hit === true)) {
        score += 15;
        const hitClause = results.map(r => (r.clauses.find(c => c.hit === true) || {}).t).find(Boolean) || '';
        if (hitClause) notes.push(`资格已达标：${hitClause}`);
      } else if (results.some(r => r.hit === null)) {
        score += 7;
        risks.push('报考资格部分条款需人工核对，建议对照公告确认');
      } else if (results.length) {
        gatePush('报考资格条款未满足');
      } else {
        score += 15;
      }
    } else {
      score += 15; // 无门槛
    }

    // 6.3 师范类专业门槛（个别地区限师范类才能报；江苏实际：本科通道常限师范类，硕士通道一般不限）
    if (j.normalMajor && degreeRank <= 2) {
      if (profile.normalMajor === '师范类') score += 10;
      else if (profile.normalMajor === '非师范类') reasons.push('要求师范类专业（本科）');
      else risks.push('岗位要求师范类专业（本科），请确认你的专业是否属于师范类');
    }

    // 6.5 学科匹配：按用户选定的学段 stage 拆分岗位实际招的学科，避免混合学段误判
    // （例：南湖#27 顶层含数学，但原文写"无小学数学岗"、小学段只招语文/美术 → 数学档案应判不符）
    const stageInfo = getStageSubjects(j, stage);   // { subjects, negated, reliable }
    let subjectOverlap = [];
    const subjectsForMatch = stageInfo.reliable ? stageInfo.subjects : (j.subjects || []);
    // 公告白纸黑字写了"无/不招 本学段某学科" → 直接判不符
    const negHit = (stageInfo.negated || []).filter(s => userSubjects.has(s));
    if (negHit.length) {
      reasons.push(`该公告${stage}段明确不招${negHit.join('、')}教师（岗位表中未设此学科岗）`);
    } else if (subjectsForMatch.length) {
      // 学科表述宽泛（"多学科/各学科/以岗位表为准"）时不可判死：可能包含用户学科，改待确认查岗位表
      const vagueSubj = subjectsForMatch.some(s => /多学科|各学科|若干|为准|详见|岗位表|相关学科|学科不限|不限学科|各科|相关/.test(s));
      subjectOverlap = subjectsForMatch.filter(s => userSubjects.has(s));
      if (subjectOverlap.length) {
        score += 10;
      } else if (userSubjects.size === 0) {
        risks.push(`岗位学科：${subjectsForMatch.join('、')}，请先填写专业或教资再判断`);
      } else if (vagueSubj) {
        risks.push(`岗位学科表述宽泛（${subjectsForMatch.slice(0, 6).join('、')}），请对照公告附件岗位表确认${stage}段是否有你的学科岗`);
      } else if (stageInfo.reliable && !stageInfo.complete && (j.subjects || []).some(s => userSubjects.has(s))) {
        // 公告只是摘要（含「等/约/其余/详见附件」），本学段岗位表可能未展开 → 提示查附件而非一刀切
        risks.push(`${stage}段公告列出的是${subjectsForMatch.join('、')}，未见你的${Array.from(userSubjects).join('/')}岗位表或有细分，请查附件岗位表确认`);
      } else {
        reasons.push(`岗位学科：${subjectsForMatch.join('、')}，与你的专业（${majorSubject || '未填'}）/教资不对口`);
      }
    } else if (/专业对口/.test(j.condition || '') && majorSubject) {
      notes.push(`公告要求专业对口，请按「${majorSubject}」方向对照岗位表选岗`);
    }

    // 6.6 数学岗限「数学类/学科教学(数学)」专业（中学数学岗常见口径）
    // 本硕双专业 + 按学段拆分：硕士/本科任一为数学类（非小学教育）即视为专业对口
    // 双重条件：①本学段确实招数学 ②用户自己就是奔数学岗去的（否则语文档案不该被数学岗限制打扰）
    // 升级：用户专业落在「小学教育/初等教育」且排除后仍非数学类 → 公告明文「不含小学教育」应直接判不符
    // mathMajorOnly=true：该岗所有含数学学段都限数学类（排除小学教育）
    // mathMajorOnlyStages=["初中","高中"]：仅这些学段限数学类（小学段接受小学教育），按当前 stage 精确判定
    const mathStageLimited = (j.rules && j.rules.mathMajorOnly) ? true
      : (j.rules && Array.isArray(j.rules.mathMajorOnlyStages) && j.rules.mathMajorOnlyStages.includes(stage));
    if (mathStageLimited && subjectsForMatch.includes('数学') && userSubjects.has('数学')) {
      const mastersIsMathClass = !/小学教育|初等教育/.test(profile.major || '') && (majorSubject === '数学');
      const bachelorsIsMathClass = !/小学教育|初等教育/.test(profile.majorBachelor || '') && (majorBachelorSubject === '数学');
      if (!(mastersIsMathClass || bachelorsIsMathClass)) {
        const shownMajor = bachelorsIsMathClass ? (profile.majorBachelor || '本科专业') : (profile.major || '当前专业');
        const isXiaoxueMajor = /小学教育|初等教育/.test(profile.majorBachelor || '') || /小学教育|初等教育/.test(profile.major || '');
        if (isXiaoxueMajor) {
          reasons.push(`数学岗限「数学类/统计学类/学科教学(数学)」等专业，公告未将小学教育(040107)列入目录，${shownMajor}不在目录 → 不能报`);
          // 告诉后续的教资段「学科专业已判不符」，不要再为同一岗位追加教资理由
          j.__majorRejected = true;
        } else {
          risks.push(`数学岗限「数学类/学科教学(数学)」等专业，${shownMajor}不在目录，能否按初中数学教资报考请电话确认`);
        }
      }
    }

    // 6.7 教学经历要求（社招岗常见「须N年及以上相应学科教学经历」，应届/无经历者不可报）
    // 仅当用户奔着该学科去时才触发，避免无关学科被误伤
    if (j.rules && j.rules.experienceRequired) {
      const isFresh = profile.graduateYear === '2026' || profile.graduateYear === '2027';
      const relevant = !subjectsForMatch.includes('数学') || userSubjects.has('数学');
      if (isFresh && relevant) {
        reasons.push(`须${j.rules.experienceRequired}，应届无教学经历不可报`);
        j.__majorRejected = true;
      } else if (relevant) {
        risks.push(`岗位要求「${j.rules.experienceRequired}」，请确认你的教学经历是否符合`);
      }
    }

    // 7. 荣誉门槛已并入第 6 节资格条款判定（V3.1），此处不再重复

    // 8. 教资（考哪门课就要哪门教资；岗位学科已判不符时不再重复判）
    const certReq = j.certLevelReq;
    const needLv = STAGE_CERT_LEVEL[stage] || 1;
    // 6.6 段已经把"专业不对口"判成不符（如 #133 小学教育类被公告明文排除），教资段不再追加理由
    if (j.__majorRejected) {
      // 跳过整个教资段
    } else if (certReq === 'none') {
      score += 15; // 应届可后补或免
    } else if (certReq === 'unknown') {
      score += 12;
      risks.push('教资要求需查看原公告核实');
    } else if (certReq === 'any') {
      if (j.subjects.length && subjectOverlap.length === 0 && userSubjects.size > 0) {
        // 学科不对口，已由 6.5 判不符
      } else {
        // 公告允许"按所学专业报考"的，教资学科可放宽
        const byMajor = /专业或教资|按所学专业|专业对口或持教资|学历专业或教资证学科/.test(j.condition || '');
        let certOK = false;
        let failMsg = '';
        if (j.subjects.length) {
          // 学科可通融：如岗位要"历史与社会"教资，持"历史"/"地理"教资也算满足
          certOK = j.subjects.some(s => (SUBJECT_EQUIV[s] || [s]).some(a => (certSubjects[a] || 0) >= needLv));
          if (!certOK) {
            const hasLowerCert = j.subjects.some(s => (SUBJECT_EQUIV[s] || [s]).some(a => certSubjects[a] !== undefined));
            if (hasLowerCert) {
              failMsg = `你持有${j.subjects.join('/')}学科教资，但学段不满足${stage}岗要求`;
            } else if (subjectOverlap.length) {
              failMsg = `岗位须${j.subjects.join('/')}学科教资，你专业对口但无该学科教资`;
            }
          }
        } else {
          certOK = userCerts.length > 0 && userMaxCertLevel >= needLv;
          if (!certOK && userCerts.length > 0) failMsg = `你暂无${stage}及以上学段教资`;
        }
        if (certOK) {
          score += 15;
        } else if (byMajor && (majorSubject || subjectOverlap.length)) {
          score += 12;
          risks.push('公告允许按所学专业报考，教资学科可放宽，请核实岗位表');
        } else if (failMsg) {
          if (isGrad) {
            score += 10;
            risks.push(failMsg + '，应届能否后补请核实公告');
          } else {
            reasons.push(failMsg);
          }
        } else if (isGrad) {
          score += 10;
          risks.push('须相应学科教资，应届能否凭合格证明/后补请核实公告');
        } else {
          reasons.push('须持相应学科教师资格证');
        }
      }
    } else {
      // primary / junior / senior：按公告明确的学段要求
      const needLv2 = CERT_LEVEL_REQ[certReq] || 1;
      if (userMaxCertLevel >= needLv2) {
        score += 15;
        if (needLv2 > 1) score += 2; // 高学段教资报低学段岗位有小加成
      } else {
        reasons.push(`须${j.certText}`);
      }
    }

    // 8.5 普通话检查已移除：江苏教师招聘普通话要求为公开常识（语文二甲，其他学科二乙），
    // 无需在匹配档位中作为差异化条件反复提示，避免对数学等学科用户造成噪音。

    // 9. 判定档位：reasons→不符；risks→待确认；notes→不影响
    let status;
    if (reasons.length > 0) status = '不符';
    else if (risks.length > 0) status = '待确认';
    else status = '可报';
    // 仅届别不符（其余条件都符合）：对 2027 届用户而言，2026 届公告属此类，前端单独成子模块作参考样本
    const cohortOnly = (status === '不符' && cohortMismatch && reasons.length === 1);

    return { ...j, score, status, reasons, risks, notes, cohortOnly };
  })
  .filter(x => x !== null)
  .sort((a, b) => b.score - a.score);
}

window.matchJobs = matchJobs;
