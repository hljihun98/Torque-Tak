"use strict";
const PI=Math.PI;

/* ══════════════════════════════════════════════════════════
   나사 제원
   ══════════════════════════════════════════════════════════ */
const PITCH={1.6:.35,2:.4,2.5:.45,3:.5,4:.7,5:.8,6:1,8:1.25,10:1.5,12:1.75,14:2,16:2,18:2.5,20:2.5,22:2.5,24:3};
const SIZES=[3,4,5,6,8,10,12];
/* ISO 4762 육각홀붙이 머리 지름 (mm) — 지원 범위(M1.6~M24) 전체를 채운다.
   빠진 호칭경은 1.65d로 떨어졌는데 M18·M22에서 +10%, M2에서 −13% 어긋났다.
   이 값은 좌면 면압과 마찰 토크의 좌면 성분(D_Km) 양쪽에 들어간다. */
const DHEAD={1.6:3,2:3.8,2.5:4.5,3:5.5,4:7,5:8.5,6:10,8:13,10:16,12:18,14:21,16:24,18:27,20:30,22:33,24:36};
/* ISO 10642 접시머리 높이 k (mm) — 접시는 호칭 길이가 머리를 포함한 전장이라
   머리 밑 유효 길이를 구하려면 이 값을 빼야 한다. M3~M12는 정확히 0.62d. */
const CSK_K={3:1.86,4:2.48,5:3.1,6:3.72,8:4.96,10:6.2,12:7.44,14:8.4,16:8.8,20:10.16};
function cskHead(d){
  if(CSK_K[d])return CSK_K[d];
  const k=Object.keys(CSK_K).map(Number).sort((a,b)=>Math.abs(a-d)-Math.abs(b-d))[0];
  return CSK_K[k]*d/k;
}

/* ══════════════════════════════════════════════════════════
   볼트 강도구분  su/sy [MPa]
   ══════════════════════════════════════════════════════════ */
const CLS={
  "12.9":{su:1200,sy:1080,label:"12.9",desc:"합금강 고강도"},
  "10.9":{su:1000,sy:900, label:"10.9",desc:"합금강"},
  "8.8" :{su:800, sy:640, label:"8.8", desc:"중탄소강"},
  "A2-70":{su:700,sy:450, label:"A2-70",desc:"SUS304 냉간압조"},
  "4.8" :{su:400, sy:320, label:"4.8", desc:"연강"},
  "A2-50":{su:500,sy:210, label:"A2-50",desc:"SUS304 연질"}
};
const CLS_SEG=["12.9","10.9","8.8","A2-70"];
/* ISO 898-1은 8.8을 호칭경으로 나눈다 — d>16에서 830/660 MPa로 올라간다.
   한 줄짜리 표로 두면 M20·M24가 3% 낮게 나오고, 근거로 적은 ISO 898-1과도 어긋난다. */
function clsOf(cls,d){
  const C=CLS[cls];
  return (cls==="8.8"&&d>16) ? Object.assign({},C,{su:830,sy:660,big:true}) : C;
}

/* ══════════════════════════════════════════════════════════
   머리 형상
   fp   : 권장 축력(=토크) 제한계수 — 조일 수 있는 목표 축력을 깎는다
   fu   : 머리 내력 계수 — 파단 하중을 깎는다 (나사부 대비 머리 쪽 한계)
   rl   : 내력 감소 머리(reduced loadability) — 머리가 나사부보다 먼저 진다
   dhr  : 좌면 지름 배수 (d 대비). null = 원추 좌면(면압 미검토)
   dkr  : 하중 도입 원 지름 배수 — 면압은 못 구해도 부재 강성에는 필요하다

   fp와 fu를 나눈 이유 — 두 한계가 서로 다른 데서 온다.
   · fu 0.80 : ISO 10642 / ISO 14581 / JIS B 1194가 규정하는 머리 내력.
     "The loadability in the head is assumed to be 80% of that in the thread for
     all sizes and all property classes" (ISO 10642:2026 NOTE 2). 전 등급 공통이고
     등급 상한이 아니다 — 세 규격 모두 12.9를 포함한다.
   · fp 0.52 : 실제로 조일 수 있는 축력은 육각홀이 먼저 제한한다. 제조사 공표값 —
     Unbrako 접시·버튼 목표 응력 420 MPa vs 표준 800 MPa = 0.525,
     Bossard 감액 토크 ≈0.45, Hobson ≈0.63. 규격이 아니라 제조사 근거다.
   · 저두 fp=fu 0.50 : DIN 6912는 위 규격군에 없고 제조사 공표 감액값도 없어 자체값이다.
     사내 M10 저두 파단 시험 1점(실측 79.98 N·m)이 기존 0.60을 낙관이라고 말한다 — 0.60이면
     예상 파단이 +23%로 넘치고, 권장 토크와 실측 파단 사이 마진이 1.29배까지 좁아진다
     (다른 머리 형상은 1.6~2.6배). 0.50이면 예상 파단이 실측과 +2%로 맞고 마진도 1.55배가 된다.
     사내 시트가 함축하는 값은 M8 0.57 / M10 0.42로 갈리는데 M10만 파단 시험에서 나온 값이다.
     그래도 0.42까지 내리지 않았다 — 한 점에 맞추면 과적합이다. 시험이 늘면 다시 잡을 자리다.
   ══════════════════════════════════════════════════════════ */
const HEAD={
  std :{label:"표준",   full:"표준 (육각홀붙이 ISO 4762)",   fp:1.00, fu:1.00, dhr:null, iso:true,  note:"제한 없음"},
  /* dkr 2.24 = ISO 10642 이론 머리 지름 dk (M3 6.72 · M5 11.2 · M8 17.92 = 2.24d) */
  cs  :{label:"접시 CS", full:"접시 CS (ISO 10642)",         fp:0.52, fu:0.80, dhr:null, dkr:2.24, cone:true, rl:true,
        note:"내력 감소 머리 — 머리 내력 80%(규격) · 조임 축력 52%(제조사)"},
  low :{label:"저두",    full:"저두 (Low head, DIN 6912)",   fp:0.50, fu:0.50, dhr:1.50, socket:true,
        note:"육각홀 뭉개짐이 실제 파괴 · 계수 50%는 사내 파단 1점 기준 자체값"},
  btn :{label:"버튼",    full:"버튼 (ISO 7380)",             fp:0.52, fu:0.80, dhr:1.90, rl:true,
        note:"내력 감소 머리 — 접시와 같은 감액 (제조사 공표 기준)"},
  /* sup은 "이 강도(σu)를 넘는 등급은 시장에서 찾기 어렵다"는 뜻이다. 등급 이름을 한 줄로
     세워 비교하면 안 된다 — A2-70(σu 700)은 8.8(σu 800)보다 약한데도 이름 순서로는 위에 온다.
     그래서 σu로 비교한다. 그래야 note가 말하는 A2-70이 경고 없이 통과한다. */
  sems:{label:"SEMS",   full:"SEMS (와셔 일체)",            fp:1.00, fu:1.00, dhr:2.10, sup:"8.8",
        note:"통상 4.8~8.8 또는 A2-70급으로 공급"}
};

/* ══════════════════════════════════════════════════════════
   모재
   su : 인장강도 [MPa]
   pG : 한계 면압 [MPa] — VDI 2230 계열 문헌값
   shear : 전단강도 보정 (기본 0.6·su)
   thin  : 박판 여부 (모델 적용 범위 밖 경고)
   ══════════════════════════════════════════════════════════ */
/* act: 혐기성 고정제 경화 활성도  1=활성(철계) 0.5=비활성(프라이머 필요) 0=금속 아님
   E  : 종탄성계수 [MPa] — 컴플라이언스(이완 손실·하중계수) 계산용 대표값 */
const MAT={
  S45C  :{su:570,pG:700,act:1,  E:205000,label:"S45C",    desc:"기계구조용 탄소강"},
  SCM440:{su:980,pG:900,act:1,  E:205000,label:"SCM440",  desc:"크롬몰리브덴강"},
  SS400 :{su:400,pG:490,act:1,  E:205000,label:"SS400",   desc:"일반 구조용 압연강"},
  SPCC  :{su:270,pG:260,act:1,  E:205000,label:"SPCC",    desc:"냉간압연 강판",thin:true},
  SUS304:{su:520,pG:630,act:.5, E:193000,label:"SUS304",  desc:"스테인리스"},
  A6061 :{su:310,pG:300,act:.5, E:69000, label:"A6061-T6",desc:"알루미늄 압출",alu:true},
  A5052 :{su:230,pG:210,act:.5, E:70000, label:"A5052",   desc:"알루미늄 판",alu:true},
  ADC12 :{su:228,pG:200,act:.5, E:71000, label:"ADC12",   desc:"알루미늄 다이캐스팅",alu:true},
  FC250 :{su:250,pG:700,act:1,  E:100000,label:"FC250",   desc:"회주철",shear:1.1},
  /* poly: 수지. 나사산 전단은 정적 강도가 아니라 크리프가 지배하므로 이 모델이 성립하지 않는다 */
  POM   :{su:65, pG:60, act:0,  E:2800,  label:"POM",     desc:"엔지니어링 플라스틱",poly:true}
};
/* 한계 면압 pG를 VDI 2230 수록 재질과 직접 대응시킬 수 있는 것만 표준 근거로 표기한다.
   나머지(스테인리스·강판·알루미늄·수지)는 문헌 외삽이라 원표 대조가 필요하다. */
const PG_VDI=new Set(["S45C","SCM440","SS400","FC250"]);

/* ══════════════════════════════════════════════════════════
   나사 고정제 (혐기성 threadlocker)
   bk/pv : M10 강재 볼트·너트, 24h @22°C, ISO 10964 [N·m]
   출처  : Henkel 공식 TDS 및 제품 스펙 (src 필드에 표기)
   ══════════════════════════════════════════════════════════ */
const LOCK={
  none:{label:"없음",  full:"나사 고정제 없음", bk:0, pv:0, desc:"고정제를 쓰지 않습니다"},
  L222:{label:"222",  full:"LOCTITE 222 (보라·저강도)", bk:6,  pv:4,  dmin:2, dmax:6,  tmax:150, red:false,
        src:"TDS", desc:"M2~M6 · 표준 공구로 분해 · 소경 볼트 전용"},
  L242:{label:"242",  full:"LOCTITE 242 (파랑·중강도)", bk:12, pv:5,  dmin:6, dmax:20, tmax:150, red:false,
        src:"공표값", desc:"M6~M20 · 범용 중강도"},
  L243:{label:"243",  full:"LOCTITE 243 (파랑·중강도·내유)", bk:26, pv:24, dmin:6, dmax:20, tmax:150, red:false,
        src:"TDS", desc:"M6~M20 · 유분 오염 허용 · 가장 널리 쓰임"},
  L271:{label:"271",  full:"LOCTITE 271 (빨강·고강도)", bk:26, pv:33, dmin:8, dmax:25, tmax:150, red:true,
        src:"제품 스펙", desc:"M8~M25 · 분해에 250°C 가열 필요"},
  L272:{label:"272",  full:"LOCTITE 272 (주황·고강도·내열)", bk:22, pv:24, dmin:8, dmax:36, tmax:200, red:true,
        src:"제품 스펙", desc:"200°C까지 · 분해에 가열 필요"},
  L290:{label:"290",  full:"LOCTITE 290 (초록·침투형)", bk:20, pv:10, dmin:3, dmax:20, tmax:150, red:false,
        src:"공표값", wick:true, desc:"조립 후 모세관 침투 도포"}
};

/* 호칭경 보정 — LOCTITE 243 TDS 실측 3점 (M6:3 / M10:26 / M16:44 N·m) 기반 로그-로그 보간 */
const LOCK_PTS=[[6,3/26],[10,1],[16,44/26]];
function lockSizeF(d){
  const P=LOCK_PTS, sl=(i,j)=>Math.log(P[j][1]/P[i][1])/Math.log(P[j][0]/P[i][0]);
  /* M6 미만은 실측 구간 밖 — 적합 구간의 지수(약 4.2)를 그대로 외삽하면
     과소평가가 심해지므로 물리 하한(면적×반경 ∝ d³)으로 제한한다. */
  if(d<P[0][0]) return P[0][1]*Math.pow(d/P[0][0],Math.min(3,sl(0,1)));
  if(d>=P[2][0]) return P[2][1]*Math.pow(d/P[2][0],sl(1,2));
  const i=d<P[1][0]?0:1;
  return P[i][1]*Math.pow(d/P[i][0],sl(i,i+1));
}
/* ISO 4032 표준 너트 높이 — TDS 시험의 기준 물림 길이 */
const NUT_H={1.6:1.3,2:1.6,2.5:2,3:2.4,4:3.2,5:4.7,6:5.2,8:6.8,10:8.4,12:10.8,14:12.8,16:14.8,18:15.8,20:18,22:19.4,24:21.5};
function nutH(d){
  if(NUT_H[d])return NUT_H[d];
  const k=Object.keys(NUT_H).map(Number).sort((a,b)=>Math.abs(a-d)-Math.abs(b-d))[0];
  return NUT_H[k]*d/k;
}

/* ══════════════════════════════════════════════════════════
   마찰 조건 — VDI 2230 Part 1 표 A5 마찰계수 등급

   예전에는 나사부·좌면·피치를 하나로 뭉친 관행 계수 K를 조건마다 상수로 박아 뒀다.
   문제는 K 숫자와 마찰계수 μ 숫자가 같지 않다는 것이다 — 피치 성분 0.16P가 K 안에
   이미 들어 있어서, K 0.20은 μ 0.20이 아니라 <b>μ 0.145</b>다. VDI 기준으로 그건
   가볍게 윤활된 B등급 표면이고, 탈지 후 건식으로 조립하는 가공면은 C등급(0.14~0.24)이다.
   그래서 건식 조건만 μ 0.18로 올라가고(등가 K 0.24, 토크 +21%) 나머지 다섯 조건은
   기존 K와 ±4% 안에서 그대로다 — 윤활 조건들은 애초에 맞게 잡혀 있었다.

   mu   : 나사부·좌면 마찰계수. 둘을 구분할 근거가 없어 μG = μK로 둔다
   cls  : VDI 2230 표 A5 마찰등급
   band : 그 등급의 μ 범위 — 토크가 어느 폭으로 흔들리는지 보여주는 데 쓴다
   ══════════════════════════════════════════════════════════ */
const KF={
  dry :{mu:.18,  cls:"C", band:[.14,.24], label:"건식 가공면",    desc:"μ 0.18 · VDI C등급 · 탈지 후 무윤활 조립 · 기본"},
  zinc:{mu:.125, cls:"B", band:[.08,.16], label:"아연 도금",       desc:"μ 0.125 · VDI B등급"},
  oil :{mu:.10,  cls:"B", band:[.08,.16], label:"오일·방청유",     desc:"μ 0.10 · VDI B등급 · 잔류 유분 포함"},
  moly:{mu:.08,  cls:"A", band:[.04,.10], label:"이황화몰리브덴",   desc:"μ 0.08 · VDI A등급"},
  lock:{mu:.14,  cls:"B", band:[.08,.16], label:"나사 고정제",     desc:"μ 0.14 · VDI B등급 · 습윤 상태가 윤활로 작용"},
  sus :{mu:.22,  cls:"C", band:[.14,.24], label:"스테인리스 건식",  desc:"μ 0.22 · VDI C등급 상단 · 소착 주의"}
};
/* VDI 2230 체결토크식을 K로 되돌린 값.
     M = F·[0.16·P + 0.58·d₂·μG + (D_Km/2)·μK]  →  K = M/(F·d)
   d₂는 유효경, D_Km은 좌면 유효 마찰경 = (좌면 지름 + 구멍 지름)/2.
   K가 호칭경·머리 형상·와셔에 따라 달라지는 게 물리적으로 맞다 — 상수 하나로 두면
   좌면이 넓은 머리와 좁은 머리가 같은 토크를 받게 된다.
   접시머리도 이 식으로 계산했을 때 표준머리 대비 0.58배가 나와 Bossard 감액표(≈0.56)와
   계속 맞는다 — 원추 보정을 따로 넣지 않는 편이 제조사 공표값에 가깝다. */
const HOLE_R = 1.1;                     // 구멍 지름 배수 — 좌면 면압 계산과 같은 값
const kOf=(d,p,mu,dw)=>{
  const d2=d-0.6495*p, DKm=(dw+HOLE_R*d)/2;
  return (0.16*p + 0.58*d2*mu + DKm/2*mu)/d;
};

const WASHER={
  none:{label:"없음",  dhr:0,    desc:"볼트 머리가 직접 접촉"},
  flat:{label:"평와셔", dhr:2.20, desc:"좌면 지름 약 2.2d — 면압 분산"},
  wide:{label:"대형",   dhr:2.80, desc:"좌면 지름 약 2.8d — 연질재용"}
};

/* 80%를 넣은 이유 — 목표 축력 %는 순수 인장 기준이라 비틀림을 더한 실제 항복 이용률과
   다르다. 80%가 이용률 88%로 VDI 관행값 90%에 가장 가깝고, 기존 90% 옵션은 이용률
   99%라 사실상 항복선이었다. */
const PL_SEG=[65,70,75,80,90];
const LOAD_SEG=[
  {v:"none",  label:"미입력"},
  {v:"axial", label:"축방향 인장"},
  {v:"shear", label:"횡방향 전단"}
];
/* 비나사부를 입력했을 때 어디까지 모델에 반영할지 — 누적 단계 */
const SLV_SEG=[
  {v:"geo",  label:"기하만",   desc:"런아웃·나사부 길이만 검사. 계산값은 안 바뀝니다"},
  {v:"embed",label:"이완 손실", desc:"이완 손실 10% 고정을 탄성 계산으로 대체"},
  {v:"phi",  label:"하중 계수", desc:"외력 중 볼트가 실제로 부담하는 몫까지 반영"}
];
const SLV_RANK={geo:0,embed:1,phi:2};
/* 시판 표준 길이 (ISO 4762 계열) — 볼트 길이 슬라이더가 여기로 스냅한다 */
const BOLT_LEN=[3,4,5,6,8,10,12,14,16,18,20,22,25,28,30,35,40,45,50,55,60,65,70,80,90,100,110,120,130,140,150,160,180,200];
/* 사양 문자열이 받아들이는 길이 상한. parse()와 길이 슬라이더가 반드시 같은 값을 봐야 한다 —
   슬라이더가 이 위를 고르면 사양이 오류 상태로 떨어져 화살표 키 한 번에 앱이
   "길이 지원 범위 초과"로 바뀐다. M5에서 실제로 그랬다(슬라이더가 200을 골라 M5-200). */
const lenCapOf=d=>Math.min(300,30*d);

/* ══════════════════════════════════════════════════════════
   모델 상수 — 출처와 성격을 명시
   ══════════════════════════════════════════════════════════ */
const KNOCK    = 0.65;  // 나사산 변형 보정 — 경험 근사값 (문헌 0.6~0.85)
const STRIP_SF = 2.0;   // 뽑힘 안전율 — K산포·공차·경험계수 불확실성 포괄
const TG_FRAC  = 0.49;  // 전체 토크 중 나사부 비율 — 표준 토크표로 교정
const K_TAU    = 0.5;   // 비틀림 감소계수 (VDI 2230)
const K_SCAT   = 0.30;  // 토크계수 산포 ±30%
/* 설계 NG 대응 — 항목별 조치. 앞쪽일수록 변경 비용이 낮다. */
const FIX={
  strip:["물림 깊이 Le를 적합 기준선까지 늘린다 — 탭 깊이·보스 높이 확보",
         "탭 인서트 삽입 (헬리코일·코일서트·키서트) — 모재는 그대로 두고 나사산 내력만 올린다",
         "관통 구멍 + 너트 체결로 바꾸거나 용접 너트를 덧댄다",
         "목표 축력 %나 볼트 강도구분을 낮춰 탭에 걸리는 힘을 줄인다"],
  thin :["버링탭(익스트루전 탭)으로 물림 길이를 판 두께 이상으로 늘린다",
         "PEM 셀프클린칭 너트·리벳 너트를 압입한다",
         "판재 뒷면에 백업 플레이트나 용접 너트를 덧댄다"],
  poly :["금속 인서트(열압입·초음파·헬리코일)를 넣고 탭 모재를 인서트 재질로 바꿔 다시 계산한다",
         "수지 전용 셀프태핑 스크류(PT·델타PT 계열)로 바꾸고 제조사 권장 토크를 그대로 쓴다",
         "관통 구멍 + 금속 너트로 바꿔 축력을 금속끼리 받게 한다",
         "축력이 필요 없는 결합(스냅핏·접착·용착)을 검토한다"],
  util :["목표 축력(% 항복)을 한 단계 낮춘다",
         "상위 강도구분으로 올려 항복 여유를 확보한다",
         "토크법 대신 각도법·축력계로 체결해 산포를 줄인다"],
  bear :["와셔를 넣거나 대형 와셔로 좌면 지름을 키운다",
         "좌면이 넓은 머리 형상(버튼·플랜지)으로 바꾼다",
         "목표 축력을 낮추거나 좌면부에 강재 부시·경화 와셔를 넣는다"],
  lockG:["적색 고강도 대신 222(저강도) 또는 243(중강도)으로 바꾼다",
         "고정제 대신 기계적 이완방지(노드록 와셔·나일론 너트)를 쓴다"],
  lockC:["수지 모재에는 혐기성 고정제가 경화하지 않는다 — 기계적 이완방지로 바꾼다",
         "수지 전용 셀프태핑 스크류나 인서트 너트(열압입·초음파)를 쓴다"],
  load :["볼트 호칭경을 한 단계 올리거나 체결 개수를 늘린다",
         "목표 축력·강도구분을 올려 이완 후 잔존 축력을 확보한다",
         "마찰 전달 대신 핀·키·숄더로 전단하중을 직접 받게 한다"],
  runout:["볼트 길이를 줄여 비나사부가 체결 두께 안에 들어오게 한다",
          "전산(전조 나사) 볼트로 바꿔 비나사부를 없앤다",
          "스페이서·칼라를 넣어 체결 두께를 비나사부보다 크게 만든다",
          "탭 구멍 입구를 카운터보어로 확장해 샹크가 들어갈 자리를 만든다"],
  cslen :["접시는 호칭 길이에 머리가 포함된다 — 머리 높이보다 긴 길이를 쓴다",
          "표준 머리로 바꾸면 호칭 길이가 머리 밑부터라 같은 숫자로도 성립한다",
          "사양 문자열의 길이 값이 맞는지 확인한다 (자릿수 오타)"],
  thlen :["나사부가 더 긴 볼트(전산 볼트)로 바꾼다",
          "물림 깊이 Le를 볼트의 실제 나사부 길이 안으로 줄인다",
          "볼트 길이를 늘려 나사부 길이를 확보한다"],
  reach :["볼트 길이를 늘려 물릴 나사부를 확보한다",
          "전산(전조 나사) 볼트로 바꿔 비나사부를 없앤다",
          "판재를 얇게 하거나 카운터보어로 좌면을 낮춰 물림에 쓸 길이를 늘린다",
          "목표 축력 %나 볼트 강도구분을 낮춰 필요 물림 자체를 줄인다"]
};

const EMBED    = 0.10;  // 임베딩/이완 손실 10%
const MU_JOINT = 0.15;  // 마찰 전달 접합면 마찰계수
const SF_AXIAL = 1.5;   // 축하중 분리 방지 안전율
const SF_SHEAR = 1.3;   // 횡하중 미끄럼 방지 안전율
const E_BOLT   = 205000;// 볼트 종탄성계수 [MPa] — 강재
const FZ_UM    = 5.0;   // 소성 임베딩량 [µm] — VDI 2230 Table 5.4 계열 중간값 (원표 대조 필요)
const FZ_UM_W  = 1.5;   // 와셔를 넣으면 접합면이 하나 늘어난다
const SF_SEP   = 1.5;   // 접합면 분리 방지 안전율 — 하중계수 모델에서 사용

const f1c=n=>n.toFixed(1);           // compute 안에서 쓰는 포맷 — 렌더 층 f1과 별개
const stressArea=(d,p)=>{const x=d-0.938194*p;return PI/4*x*x;};
const tauOf=m=>MAT[m].su*0.6*(MAT[m].shear||1);
const stripArea=(d,Le)=>0.875*PI*d*Le*KNOCK;
const polarMod=(d,p)=>{const d3=d-1.226869*p;return PI*Math.pow(d3,3)/16;};

/* 원추 좌면 판정이 와셔보다 앞에 와야 한다. 접시머리는 카운터싱크에 앉으므로
   평와셔가 좌면이 될 수 없는데, 와셔를 먼저 보면 있지도 않은 좌면 면압이
   "적합"으로 계산돼 나온다(접시+평와셔에서 110 MPa가 뜨던 자리). */
function bearingDia(d,head,washer){
  const H=HEAD[head];
  if(H.cone)return null;                       // 원추 좌면 — 와셔 선택과 무관하게 미검토
  const w=WASHER[washer];
  if(w&&w.dhr>0)return w.dhr*d;               // 와셔가 좌면을 지배
  if(H.iso)return DHEAD[d]||1.65*d;
  return H.dhr?H.dhr*d:null;
}

/* ══════════════════════════════════════════════════════════
   핵심 계산
   ══════════════════════════════════════════════════════════ */
function compute(o,_probe){
  const p=o.pitch, d=o.d, H=HEAD[o.head], M=MAT[o.mat], F_=KF[o.k];
  /* 접시머리에 평와셔를 끼울 자리는 없다 — 선택돼 있어도 무시하고 그 사실을 알린다.
     좌면 지름·이완 손실·단면도가 전부 이 하나를 보게 묶어 둔다. */
  const washerSel=o.washer||"none";
  const washerIgnored = washerSel!=="none" && !!H.cone;
  const washer = washerIgnored ? "none" : washerSel;
  const washerOn = washer!=="none";

  /* 좌면 지름을 토크보다 먼저 잡는다 — 마찰 토크의 좌면 성분이 여기에 비례한다.
     Db는 면압을 "검토할 수 있는" 지름이라 접시는 null이지만, 마찰은 원추 좌면에서도
     생기므로 이론 머리 지름(ISO 10642 2.24d)으로 받는다. */
  const Db = bearingDia(d,o.head,washer);
  const dLoad = Db || (H.dkr?H.dkr*d:1.65*d);
  const mu = F_.mu;
  const K  = kOf(d,p,mu,dLoad);
  /* 마찰등급 폭이 만드는 토크 폭 — ±30% 산포와 별개로 "등급을 잘못 고르면" 생기는 오차다 */
  const Klo = kOf(d,p,F_.band[0],dLoad), Khi = kOf(d,p,F_.band[1],dLoad);

  /* 선택한 강도구분을 그대로 쓴다. 예전에는 접시·저두·버튼을 10.9로 몰래 낮췄지만,
     ISO 10642 · ISO 14581 · JIS B 1194 모두 12.9를 포함한다 — 규격은 등급을 제한하지
     않고 하중을 깎는다. 등급이 공급 관행을 넘으면 검토 항목에서 경고한다. */
  const cls=o.cls, C=clsOf(cls,d);

  const As=stressArea(d,p), Fy=As*C.sy, Fu=As*C.su;

  /* 머리 형상 제한은 축력에 먼저 적용 — 토크와 축력의 정합성 확보 */
  const Fwant = o.preload/100*Fy;      // 제한 전 목표
  const Fhead = Fwant*H.fp;            // 조일 수 있는 축력 (육각홀 제한 반영)
  let Feff = Fhead;                    // 최종 적용 축력
  const FuHead = Fu*H.fu;              // 머리 내력 한계 — 파단은 여기서 난다

  /* ── 체결부 기하 ─────────────────────────────────────────
     길이 세 개를 구분해야 한다. 예전에는 Lu 하나로 둘을 겸해 접시머리의 체결 두께가
     머리 높이만큼 얇게 나왔다 (접시 M6-16 Le6 → 6.3mm로 표시, 실제 판재는 10mm).

     · Lu    = L − 머리높이  : 볼트에서 머리 밑 원통부 길이. "얼마나 물릴 수 있나"
     · Lk    = L − Le        : 체결 두께 = 클램프되는 판재 두께.
                               접시는 머리가 판에 잠기므로 카운터싱크도 판재의 일부다.
                               표준머리는 L이 머리 밑부터라 두 식이 같은 값이 된다.
     · Lbore = Lu − Le       : 판재 안에서 볼트 원통부가 지나는 구간.
                               접시는 카운터싱크 아래쪽만 남는다 — 샹크가 들어갈 자리다. */
  const headH= H.cone?cskHead(d):0;            // 접시는 호칭 길이에 머리가 포함된다
  /* 접시는 호칭 길이가 머리를 포함하므로 머리 높이보다 짧은 길이는 성립하지 않는다.
     그냥 빼면 Lu가 음수가 되고, LeReach가 0으로 뭉개져 검토 항목이 "비나사부가 볼트를
     다 먹었다"고 — 비나사부가 0인데도 — 엉뚱한 범인을 지목했다. 성립 불가를 따로 잡는다. */
  const lenOK   = o.len!=null && o.len>0;
  const shortCs = lenOK && !!H.cone && o.len<=headH;
  const Lu   = (lenOK && !shortCs) ? o.len-headH : null;   // 머리 밑 원통부 길이
  const ls   = Math.max(0,o.shank||0);
  /* 볼트가 내줄 수 있는 최대 물림 — 판재 두께 0을 가정한 최선의 경우.
     비나사부와 불완전 나사 2피치에는 물릴 나사산이 없으므로 뺀다. */
  const LeReach = Lu==null ? null : Math.max(0, ls>0 ? Lu-ls-2*p : Lu);

  /* 나사산 뽑힘 — Fstrip은 Le에 정비례하므로 계수 stripK로 묶어 둔다 */
  const tauU   = tauOf(o.mat);
  const stripK = 0.875*PI*d*tauU*KNOCK;        // Fstrip = stripK × Le
  const hasLe  = o.Le>0;
  const Ats    = hasLe?stripArea(d,o.Le):null;
  const Fstrip = hasLe?Ats*tauU:null;
  const LeMin  = FuHead/stripK;                // 볼트(머리 내력 포함)가 먼저 파단하는 물림
  const margin = hasLe?Fstrip/Fhead:null;      // 제한 전 기준 = 실제 여유
  /* 판정이 "적합"으로 바뀌는 최소 Le — Le에 의존하는 검토만 고려.
     기하보다 뒤에 두면 도달 가능성 판단에 쓸 수 없어 여기서 구한다. */
  const LeOk = Math.max(
    2.5*Fhead/stripK,             // 뽑힘 여유 2.5배
    6*p,                          // 유효 나사산 6산
    M.thin?4:0,                   // 박판 모재 최소 물림
    LeMin                         // 볼트가 먼저 파단하는 조건
  );
  /* Le 미설정의 "탭 충분 가정"은 볼트가 그만큼 물릴 수 있을 때만 성립한다.
     짧은 볼트는 판재 두께 0을 가정해도 기준 물림에 못 닿으므로 도달 가능한
     최대 물림으로 축력을 묶는다 — 그래야 길이를 바꾸면 토크가 따라 움직인다. */
  const LeAssume = (!hasLe&&LeReach!=null&&LeReach>0) ? Math.min(LeOk,LeReach) : null;
  /* 가정값이 기준값이 아니라 길이 한도에서 왔는지 — 문구를 여기로 갈라야 한다.
     reachLimited(토크까지 깎였는지)와는 다르다. 한도에 걸렸어도 뽑힘 여유가
     남아 토크는 그대로일 수 있다. */
  const reachCapped = LeAssume!=null && LeAssume < LeOk-1e-9;
  let limited=false, reachLimited=false;
  if(hasLe){
    if(Fstrip/STRIP_SF < Feff){ Feff=Fstrip/STRIP_SF; limited=true; }
  }else if(LeAssume!=null){
    const Fa=stripK*LeAssume;
    if(Fa/STRIP_SF < Feff){ Feff=Fa/STRIP_SF; limited=true; reachLimited=true; }
  }
  /* 화면·단면도가 함께 쓰는 표시용 물림 — 미설정이면 가정값, 그마저 없으면 기준값 */
  const LeShow = hasLe?o.Le:(LeAssume!=null?LeAssume:LeOk);

  const Trec   = K*Feff*d/1000;
  const Fbreak = hasLe    ? Math.min(FuHead,Fstrip)
               : LeAssume!=null ? Math.min(FuHead,stripK*LeAssume)
               : FuHead;
  const Tbreak = K*Fbreak*d/1000;

  /* 축력 산포 (토크 고정, K가 흔들림) */
  const Flo = Feff/(1+K_SCAT), Fhi = Feff/(1-K_SCAT);

  /* 체결 중 조합응력 (인장 + 비틀림) */
  const Wp    = polarMod(d,p);
  const sigma = Feff/As;
  const tau   = TG_FRAC*(K*Feff*d)/Wp;
  const sigEq = Math.sqrt(sigma*sigma + 3*Math.pow(K_TAU*tau,2));
  const util  = sigEq/C.sy;

  /* 좌면 면압 */
  let pBear=null, pRatio=null;
  if(Db){
    const Ab=PI/4*(Db*Db - Math.pow(HOLE_R*d,2));
    pBear = Fhi/Ab;                            // 상한 축력으로 검토
    pRatio= pBear/M.pG;
  }

  /* ── 비나사부 · 탄성 컴플라이언스 ──────────────────────
     볼트 길이에서 물림 Le를 빼면 체결 두께 Lk가 나온다.
     비나사부 ls까지 알면 볼트를 구간별로 나눠 컴플라이언스를 쌓을 수 있고,
     그러면 이완 손실을 고정 비율이 아니라 변위 f_Z에서 직접 구할 수 있다.
     볼트 쪽 구간 분해는 원통부 Lbore로, 부재 쪽 압축 원추는 실제 클램프 두께 Lk로 나눈다.
     접시의 카운터싱크 구간은 원통이 아니라 원추라 볼트 구간에 넣지 않고,
     머리 변형 항 δSK(0.5d)가 대신 받는 것으로 본다 — VDI에 접시머리 모델은 없다. */
  const AN   = PI/4*d*d;                       // 비나사부(전경) 단면적
  const dRoot= d-1.226869*p, Ad3=PI/4*dRoot*dRoot;
  /* 성립 불가 길이(shortCs)에서는 체결 두께도 뜻이 없다 — Lbore만 null이고 Lk는 값이
     남으면 화면이 "체결 두께 0.1mm"처럼 존재하지 않는 치수를 보여준다. */
  const Lk   = (lenOK&&!shortCs&&hasLe) ? o.len-o.Le : null;  // 체결 두께 = 판재 두께
  const Lbore= (Lu!=null&&hasLe) ? Lu-o.Le : null;                 // 판재 안 원통 구간
  const slv  = SLV_RANK[o.slevel]!=null ? o.slevel : "embed";
  const shankOn = ls>0 && Lbore!=null && Lbore>0;
  const lg   = shankOn ? Math.max(0,Lbore-Math.min(ls,Lbore)) : null;

  let dS=null,dP=null,phi=null,Fz=null,embedCalc=null,embedCapped=false,turnDeg=null;
  /* 하중 도입 원 지름은 위에서 잡은 dLoad를 그대로 쓴다 — 마찰 좌면과 하중이 판재로
     퍼지기 시작하는 원이 같은 원이다. 접시는 ISO 10642 이론 머리 지름 2.24d. */
  if(shankOn){
    /* 볼트 컴플라이언스 — VDI 2230 Part 1 구간 분해 */
    const dSK = 0.5*d/(E_BOLT*AN);                      // 머리
    const d1  = Math.min(ls,Lbore)/(E_BOLT*AN);         // 비나사부
    const dGew= lg/(E_BOLT*Ad3);                        // 그립 안 미물림 나사부
    const dGM = 0.5*d/(E_BOLT*Ad3)+0.4*d/(M.E*AN);      // 물림 나사부 + 탭 모재
    dS = dSK+d1+dGew+dGM;
    /* 부재 컴플라이언스 — Rötscher 30° 압축 원추 (Shigley).
       탭 조인트라 유효 그립에 d/2를 더하고 같은 원추 2개 직렬로 본다. */
    const dw=dLoad, t=(Lk+d/2)/2;
    const num=dw!=null?(1.155*t+dw-d)*(dw+d):0, den=dw!=null?(1.155*t+dw+d)*(dw-d):0;
    if(dw!=null && dw>d*1.02 && den>0 && num/den>1){
      dP = 2*Math.log(num/den)/(0.5774*PI*M.E*d);       // 원추 2개 직렬
      const fZ=(FZ_UM+(washerOn?FZ_UM_W:0))/1000;
      Fz = fZ/(dS+dP);
      embedCalc = Fz/Feff;
      /* 축력 절반을 넘는 이완은 모델 밖이다 — 캡을 걸되 걸렸다는 사실을 남긴다 */
      if(embedCalc>0.5){ embedCalc=0.5; embedCapped=true; }
      phi = dP/(dS+dP);                                 // 하중계수 (도입계수 n=1 보수)
      /* 각도법 참고값 — 밀착 후 필요한 회전각.
         볼트 신장 + 부재 압축을 모두 감아야 하고, 샹크 비틀림만큼 더 돌아간다. */
      const Ip=PI*Math.pow(d,4)/32;
      turnDeg = Feff*(dS+dP)/p*360 + TG_FRAC*(K*Feff*d)*ls/(79000*Ip)*180/PI;
    }
  }
  const useEmbed = shankOn && embedCalc!=null && SLV_RANK[slv]>=1;
  const usePhi   = shankOn && phi!=null && SLV_RANK[slv]>=2;
  const embedUse = useEmbed ? embedCalc : EMBED;

  /* ── 나사 고정제 · 제거 토크 ─────────────────────────
     T_제거 = 잔존 축력에 의한 마찰분 + 고정제 이탈분
     마찰분: K·d에는 피치 성분 +p/2π가 한 번 들어 있다. 풀 때는 이 항의 부호가
             뒤집히므로 두 번 빼야 한다 → (K·d − p/π). 한 번만 빼면 순수 마찰분이다.
     고정제분: TDS M10 값 × 호칭경 보정 × (실제 물림 / 표준 너트 높이) */
  const L = LOCK[o.lock||"none"];
  const Fserv0 = Feff*(1-embedUse);
  const Tfric = Math.max(0,Fserv0*(K*d - p/PI))/1000;
  let Tadh=0, Trem=null, remRatio=null;
  let adhBase=null;
  if(L.bk>0){
    const eng = hasLe ? o.Le : nutH(d);
    /* 이탈(breakaway)과 프리베일링 중 큰 쪽으로 보수 산정한다. 271·272는 프리베일이 더 커서
       실제로 쓰이는 값이 이탈 토크가 아니다 — 화면에 어느 쪽을 썼는지 밝힌다. */
    adhBase = L.pv>L.bk ? "pv" : "bk";
    Tadh = Math.max(L.bk,L.pv) * lockSizeF(d) * (eng/nutH(d)) * (M.act||0.0001);
    Trem = Tfric + Tadh;
  }

  /* 하중 대비 축력 */
  const Fserv = Fserv0;                // 이완 후 잔존 축력
  let Freq=null, Fsa=null, sigMax=null;
  if(o.loadType!=="none" && o.load>0){
    if(o.loadType==="axial"){
      /* 하중계수를 쓰면 외력의 (1−Φ)만 접합면 클램프력을 깎는다.
         전량을 축력으로 막게 하는 기존 식보다 현실적이다. */
      Freq = usePhi ? SF_SEP*(1-phi)*o.load : SF_AXIAL*o.load;
      if(usePhi){ Fsa = phi*o.load; sigMax = (Fserv+Fsa)/As; }
    }else{
      Freq = SF_SHEAR*o.load/MU_JOINT;   // 횡하중은 외력이 축방향이 아니라 Φ 무관
    }
  }

  if(Trem!==null) remRatio = Trem/Tbreak;
  const threads = hasLe?o.Le/p:null;
  const thinRegime = hasLe && (threads<3 || o.Le<2.5);

  /* ── 검토 항목 ─────────────────────────────────────────── */
  const checks=[];
  /* kind: "str"=구조 안전(설계 NG 가능) / "svc"=정비성(최대 주의까지)
     정비성 항목은 모델 불확실성이 커서 설계 판정을 뒤집지 않는다. */
  /* fix: 설계 NG일 때만 화면에 펼치는 대응 방법 */
  const add=(lvl,name,detail,val,kind,fix)=>{
    if(kind==="svc"&&lvl==="bad")lvl="warn";
    checks.push({lvl,name,detail,val,kind:kind||"str",fix:fix||null});
  };

  if(!hasLe) add("na","나사산 뽑힘","Le를 설정하면 검토합니다","—");
  else if(margin<1.0) add("bad","나사산 뽑힘","목표 축력만으로도 뽑힘 — 즉시 재설계",margin.toFixed(2)+"배","str",FIX.strip);
  else if(margin<STRIP_SF) add("bad","나사산 뽑힘","여유 부족 (기준 "+STRIP_SF.toFixed(1)+"배) · 토크를 하향 제한했습니다",margin.toFixed(2)+"배","str",FIX.strip);
  else if(o.Le<LeMin) add("warn","나사산 뽑힘","여유는 확보했으나 과하중 시 볼트보다 나사산이 먼저 뽑힙니다",margin.toFixed(2)+"배");
  else if(margin<2.5) add("warn","나사산 뽑힘","기준은 만족하나 여유가 작습니다",margin.toFixed(2)+"배");
  else add("ok","나사산 뽑힘","탭 내력 충분 · 볼트 목 파단 지배",margin.toFixed(2)+"배");

  if(!hasLe) add("na","유효 나사산 수","Le를 설정하면 검토합니다","—");
  else if(threads<4) add("bad","유효 나사산 수","4산 미만 — 구조 안전 기준 미달",threads.toFixed(1)+"산","str",FIX.strip);
  else if(threads<6) add("warn","유효 나사산 수","6산 확보 권장",threads.toFixed(1)+"산");
  else add("ok","유효 나사산 수","6산 이상 확보",threads.toFixed(1)+"산");

  /* 볼트 길이 여유 — 판재 두께 0을 가정한 최선의 경우에도 기준을 만족하는지.
     Le 설정과 무관하게 "이 길이를 고른 것이 맞는가"를 보는 항목이다. */
  if(shortCs)
    add("bad","볼트 길이","접시머리 높이 "+f1c(headH)+" mm보다 짧은 볼트는 성립하지 않습니다 — "
        +"접시는 호칭 길이에 머리가 포함됩니다","M"+d+"×"+o.len,"str",FIX.cslen);
  else if(LeReach===null) add("na","볼트 길이 여유","볼트 길이를 입력하면 검토합니다","—");
  else if(LeReach<=0) add("na","볼트 길이 여유",ls>0
      ?"비나사부가 볼트를 다 먹어 물릴 나사부가 없습니다"
      :"물릴 나사부가 남지 않습니다","—");
  else if(LeReach<LeMin)
    add("bad","볼트 길이 여유","판재 두께 0을 가정해도 최대 물림 "+LeReach.toFixed(1)
        +" mm < 최소 "+LeMin.toFixed(1)+" mm — 볼트가 짧습니다",LeReach.toFixed(1)+" mm","str",FIX.reach);
  else if(LeReach<LeOk)
    add("warn","볼트 길이 여유","최대 물림 "+LeReach.toFixed(1)+" mm로는 적합 기준 "
        +LeOk.toFixed(1)+" mm에 못 미칩니다 — 판재를 0으로 해도 여유가 없습니다",LeReach.toFixed(1)+" mm");
  else
    add("ok","볼트 길이 여유","적합 기준 "+LeOk.toFixed(1)+" mm까지 물릴 여지가 있습니다",LeReach.toFixed(1)+" mm");

  /* 비나사부 기하 — 입력했을 때만. 해석 수준과 무관하게 항상 검사한다 */
  if(ls>0){
    if(Lu==null) add("na","나사 런아웃","볼트 길이를 입력하면 검토합니다","—");
    else if(!hasLe) add("na","나사 런아웃","Le를 설정하면 검토합니다","—");
    else if(Lbore<=0)
      add("bad","나사 런아웃","물림 "+o.Le.toFixed(1)+" mm가 머리 밑 길이 "+Lu.toFixed(1)+" mm보다 깁니다 — 사양을 확인하세요",
          "체결 두께 0","str",FIX.thlen);
    else if(ls>=Lu)
      /* 설계 문제가 아니라 입력이 성립하지 않는 경우 — 음수 나사부 길이를 보여주지 않는다 */
      add("bad","비나사부 입력","비나사부 "+ls.toFixed(1)+" mm가 머리 밑 길이 "+Lu.toFixed(1)
          +" mm 이상입니다 — 나사부가 남지 않는 볼트입니다",ls.toFixed(1)+" mm","str",FIX.thlen);
    else{
      /* 실물 볼트는 샹크와 완전나사부 사이에 불완전 나사부가 1~2피치 있다.
         샹크가 들어갈 자리는 판재 두께가 아니라 그 안의 원통 구간 Lbore다 —
         접시는 카운터싱크가 머리 몫이라 그만큼 좁다. */
      const lsEff=ls+2*p, slack=Lbore-lsEff;
      if(slack<0)
        add("bad","나사 런아웃","비나사부 "+lsEff.toFixed(1)+" mm(불완전 나사 2피치 포함) > 볼트가 지나는 구간 "+Lbore.toFixed(1)
            +" mm — 샹크가 탭 면에 먼저 닿아 축력이 생기지 않습니다","+"+(-slack).toFixed(1)+" mm","str",FIX.runout);
      else if(slack<Lbore*0.1)
        add("warn","나사 런아웃","체결 두께에 근접 — 공차에 따라 샹크가 먼저 닿을 수 있습니다",slack.toFixed(1)+" mm 여유");
      else
        add("ok","나사 런아웃","샹크가 체결 두께 안에 들어옵니다",slack.toFixed(1)+" mm 여유");

      const thAvail=Lu-ls;                       // 볼트에 실제로 있는 나사부 길이
      if(o.Le>thAvail)
        add("bad","볼트 나사부 길이","물림 "+o.Le.toFixed(1)+" mm > 볼트 나사부 "+thAvail.toFixed(1)
            +" mm — 없는 나사산을 가정하고 있습니다",thAvail.toFixed(1)+" mm","str",FIX.thlen);
      else
        add("ok","볼트 나사부 길이","나사부 "+thAvail.toFixed(1)+" mm 중 "+o.Le.toFixed(1)+" mm 물림",thAvail.toFixed(1)+" mm");
    }
  }

  /* 수지 탭은 나사산 전단 이전에 크리프가 축력을 빼앗는다 — 정적 강도 모델의 전제가 없다.
     박판보다 먼저 걸러야 두 항목이 겹치지 않는다. */
  if(M.poly)
    add("bad","모델 적용 범위","수지 모재 — 크리프·응력완화로 축력이 시간에 따라 빠집니다. 정적 나사산 전단 모델로는 판정할 수 없습니다","범위 밖","str",FIX.poly);
  else if(thinRegime)
    add("bad","모델 적용 범위","박판·소수 나사산 — 판재 함몰/찢김이 지배. 이 계산은 근거가 되지 못합니다","범위 밖","str",FIX.thin);
  else if(hasLe && M.thin && o.Le<4)
    add("warn","모델 적용 범위","박판 모재에 얕은 물림 — 실물 검증 필요","주의");

  /* 내력 감소 머리 — 규격이 등급을 막지 않으므로 낮추지 않고 알린다.
     12.9는 경도가 높아 수소취성에 취약하고, 등급을 올려도 육각홀이 먼저 한계라
     걸 수 있는 토크가 거의 안 늘어난다 (Bossard 감액표 M10: 08.8 35 / 010.9 38 N·m). */
  if(H.rl){
    /* 머리가 먼저 진다는 사실은 이 머리 형상을 고르면 항상 참이므로 별도 항목으로
       매번 경고하지 않는다. 그러면 접시·버튼은 영원히 "적합"이 못 되고 판정이 무의미해진다.
       상시 사실은 설명문과 모델 한계에 두고, 항목은 등급 선택만 판정한다. */
    const headNote="머리 단면이 나사부보다 작아 파단은 머리에서 납니다 — 안전 관련 체결부에는 표준 머리를 쓰세요";
    if(cls==="12.9")
      add("warn","머리 내력 등급","12.9는 수소취성에 취약합니다(390 HV 초과). 등급을 올려도 육각홀 한계 때문에 "
          +"조일 수 있는 토크는 거의 늘지 않습니다 — 10.9 권장. "+headNote,cls);
    else
      add("ok","머리 내력 등급","머리 내력 "+(H.fu*100).toFixed(0)+"%(규격) · 조임 축력 "
          +(H.fp*100).toFixed(0)+"%(제조사) 반영. "+headNote,cls);
  }
  /* 저두는 육각홀이 얕아 볼트가 끊어지기 전에 렌치 홀이 먼저 뭉개진다. 계수로 표현되지 않는
     모드라(모델 한계 4) 계산으로는 못 잡고, 그래서 화면에서 말로 알린다. 지금까지 저두를 고르면
     검토 항목이 아무 말도 하지 않았다 — rl 플래그가 없어서다.
     rl과 같은 원칙을 따른다: 상시 참인 사실로 매번 경고하면 저두는 영원히 "적합"이 못 되므로
     항목은 등급 선택만 판정하고, 상시 사실은 설명문에 붙인다. */
  if(H.socket){
    const sockNote="육각홀이 얕아 볼트보다 렌치 홀이 먼저 뭉개집니다 — 이 모델은 그 한계를 계산하지 않습니다";
    if(cls==="12.9")
      add("warn","저두 육각홀","등급을 올려도 얕은 육각홀이 먼저 한계라 걸 수 있는 토크가 늘지 않습니다. "
          +sockNote+" · 10.9 이하 권장",cls);
    else
      add("ok","저두 육각홀","감액 "+(H.fp*100).toFixed(0)+"%(사내 파단 1점 기준) 반영. "+sockNote,cls);
  }
  /* 공급 관행 등급 — 규격 제한이 아니라 시장에서 그 등급으로 나오지 않는다는 뜻.
     등급 이름 순서가 아니라 σu로 비교한다. A2-70(700)은 8.8(800)보다 약하므로 통과해야
     하는데, 이름을 한 줄로 세우면 스테인리스가 위로 올라가 사내 실측 조건(SEMS+A2-70)에
     엉뚱한 경고가 붙었다. */
  if(H.sup&&C.su>CLS[H.sup].su)
    add("warn","공급 등급",H.label+"는 통상 σu "+CLS[H.sup].su+" MPa(예: "+H.sup+") 이하로 공급됩니다 — "
        +cls+" 실물이 있는지 확인하세요",cls,"svc");

  /* 접시에 와셔를 골라 둔 상태 — 조용히 무시하면 왜 좌면 면압이 "—"인지 알 수 없다 */
  if(washerIgnored)
    add("warn","와셔 선택","접시머리는 카운터싱크에 앉으므로 "+WASHER[washerSel].label
        +"가 좌면이 되지 못합니다 — 와셔 없음으로 계산했습니다",WASHER[washerSel].label,"svc");

  if(util>1.0) add("bad","체결 중 조합응력","인장+비틀림 등가응력이 항복 초과 — 축력 설정을 낮추세요",(util*100).toFixed(0)+"%","str",FIX.util);
  else if(util>0.90) add("warn","체결 중 조합응력","VDI 기준 이용률 90% 초과 — 여유 없음",(util*100).toFixed(0)+"%");
  else add("ok","체결 중 조합응력","항복 이용률 적정",(util*100).toFixed(0)+"%");

  /* 좌면을 받는 것은 클램프 판재인데 이 모델은 탭 모재 물성으로 계산한다.
     가정을 통과할 때만 밝히면 정작 NG를 낼 때 근거를 숨기는 셈이라 세 갈래 모두에 적는다 —
     강재 브래킷을 알루미늄 하우징에 조이면 없는 NG가, 그 반대면 있는 NG가 사라진다. */
  const seatAsm="좌면 재질=탭 모재 가정";
  if(!Db) add("na","좌면 면압",HEAD[o.head].cone?"접시머리 원추 좌면 — 이 모델은 검토하지 않습니다":"좌면 형상 미정","—");
  else if(pRatio>1.0) add("bad","좌면 면압","한계 면압 "+M.pG+" MPa 초과 — 좌면이 함몰됩니다 ("+seatAsm+" · 실제 판재가 다르면 다시 보세요)",Math.round(pBear)+" MPa","str",FIX.bear);
  else if(pRatio>0.85) add("warn","좌면 면압","한계 면압에 근접 ("+M.pG+" MPa · "+seatAsm+")",Math.round(pBear)+" MPa");
  else add("ok","좌면 면압","한계 "+M.pG+" MPa 이내 ("+seatAsm+")",Math.round(pBear)+" MPa");

  if(L.bk>0){
    /* 제거 시 볼트 파손 위험 */
    if(remRatio>1.0) add("warn","분해 난이도","제거 토크가 볼트 파단 추정값을 넘습니다 — 저강도 등급(222)으로 바꾸거나 가열 분해를 전제하세요",(remRatio*100).toFixed(0)+"%","svc");
    else if(remRatio>0.9) add("warn","분해 난이도","제거 토크가 볼트 파단 추정값에 근접 — 물림이 길수록 불리합니다. 222 검토 권장",(remRatio*100).toFixed(0)+"%","svc");
    else if(remRatio>0.7) add("warn","분해 난이도","제거 토크가 파단 추정값의 70%를 넘습니다",(remRatio*100).toFixed(0)+"%","svc");
    else add("ok","분해 난이도","표준 공구로 분해 가능",(remRatio*100).toFixed(0)+"%","svc");

    /* 제조사 사이즈·재질 권장 범위 */
    if(L.red&&d<8)
      add("bad","고정제 등급 선정","적색 고강도는 M8 미만 금지 — 제거 시 볼트·나사산이 먼저 파손됩니다","M"+d,"str",FIX.lockG);
    else if(L.red&&M.alu)
      add("bad","고정제 등급 선정","알루미늄 탭에 적색 고강도 금지 — 제거하려면 250°C 가열이 필요하고 주물이 손상됩니다","알루미늄","str",FIX.lockG);
    else if(d>L.dmax)
      add("warn","고정제 등급 선정",L.label+"의 권장 상한은 M"+L.dmax+"입니다","M"+d);
    else if(d<L.dmin)
      add("warn","고정제 등급 선정",L.label+"의 권장 하한은 M"+L.dmin+" — 소경에는 222가 적합합니다","M"+d);
    else add("ok","고정제 등급 선정","권장 범위 M"+L.dmin+"~M"+L.dmax+" 이내","M"+d);

    /* 혐기성 경화 활성도 */
    if(M.act===0) add("bad","고정제 경화","혐기성 고정제는 금속 전용입니다. 수지 모재에는 경화하지 않습니다","불가","str",FIX.lockC);
    else if(M.act<1) add("warn","고정제 경화","비활성 모재 — 프라이머(SF 7471/7649) 없이는 경화가 느리고 강도가 절반 수준입니다","비활성");
    else add("ok","고정제 경화","활성 철계 모재 — 정상 경화","활성");

    /* 체결 조건 정합 */
    if(o.k==="dry"||o.k==="sus")
      add("warn","체결 조건 정합","고정제 도포 시 습윤 상태가 윤활로 작용합니다. 체결 조건을 '나사 고정제'로 바꾸세요",KF[o.k].label,"svc");
  }

  /* 하중은 볼트 한 개·접합면 한 개 기준이다. 조인트 전체 하중을 넣으면 볼트 수만큼 틀리므로
     항목 문구에 매번 적어 둔다 — 입력칸 라벨만으로는 결과를 볼 때 이미 잊는다. */
  const perBolt=" (볼트 1개 기준)";
  if(Freq===null) add("na","작용 하중 대비","볼트 1개가 받는 하중을 입력하면 필요 축력을 검토합니다","—");
  else if(Fserv<Freq) add("bad","작용 하중 대비","이완 후 잔존 축력 "+Math.round(Fserv).toLocaleString()+" N < 필요 "+Math.round(Freq).toLocaleString()+" N — 축력 부족"+perBolt,(Fserv/Freq).toFixed(2)+"배","str",FIX.load);
  else if(Fserv<Freq*1.2) add("warn","작용 하중 대비","필요 축력을 겨우 만족"+perBolt+(usePhi?" · 하중계수 반영":""),(Fserv/Freq).toFixed(2)+"배");
  else add("ok","작용 하중 대비","필요 "+Math.round(Freq).toLocaleString()+" N 대비 충분"+perBolt
      +(usePhi?" — 외력의 "+((1-phi)*100).toFixed(0)+"%만 클램프력을 깎습니다":""),(Fserv/Freq).toFixed(2)+"배");

  /* 하중계수 수준에서만 — 외력 분담분까지 더한 볼트 응력 */
  if(usePhi&&sigMax!=null){
    const r=sigMax/C.sy;
    if(r>1.0) add("bad","외력 포함 볼트 응력","잔존 축력 + 외력 분담 "+Math.round(Fsa).toLocaleString()+" N이 항복 초과",
        (r*100).toFixed(0)+"%","str",FIX.load);
    else if(r>0.9) add("warn","외력 포함 볼트 응력","항복에 근접 — 여유가 없습니다",(r*100).toFixed(0)+"%");
    else add("ok","외력 포함 볼트 응력","외력 중 볼트 분담 "+Math.round(Fsa).toLocaleString()+" N (Φ "+(phi*100).toFixed(0)+"%)",
        (r*100).toFixed(0)+"%");
  }

  /* ── 종합 판정 ─────────────────────────────────────────── */
  /* Le를 기준선까지 올렸을 때 실제로 적합해지는지 직접 계산해 확인.
     좌면 면압은 뽑힘 하향 제한을 통해 Le에 간접 의존하므로 추정이 아니라 실측이 필요하다. */
  let okPossible=true;
  if(!_probe){
    const t=compute(Object.assign({},o,{Le:LeOk*1.002}),true);
    /* Le 기준선의 의미는 "구조적으로 적합해지는 지점"이다.
       정비성 항목은 Le로 해결되지 않으므로 판정에서 제외한다. */
    okPossible=!t.checks.some(c=>c.kind!=="svc"&&c.lvl!=="ok"&&c.lvl!=="na");
  }
  const nBad=checks.filter(c=>c.lvl==="bad").length;
  const nWarn=checks.filter(c=>c.lvl==="warn").length;
  let lvl,tag,txt;
  /* 볼트 길이만으로도 확정되는 NG(길이 부족)는 Le 미설정이어도 숨기지 않는다 */
  if(!hasLe&&!nBad){
    lvl="idle"; tag="물림 깊이를 맞추세요";
    txt = reachCapped
        ? "볼트 길이로 물릴 수 있는 최대 "+LeAssume.toFixed(1)+" mm 가정"
          +(reachLimited?" · 토크를 그만큼 제한했습니다":" · 뽑힘 여유는 아직 남습니다")
        : LeAssume!=null
        ? "적합 기준 물림 "+LeAssume.toFixed(1)+" mm 가정 · 뽑힘·나사산 수는 아직 판정 전"
        : "탭 충분 가정 · 뽑힘·나사산 수는 아직 판정 전";
  }else if(nBad){
    lvl="bad"; tag="설계 NG";
    txt=checks.filter(c=>c.lvl==="bad").map(c=>c.name).join(" · ")+" 부적합";
  }else if(nWarn){
    const w=checks.filter(c=>c.lvl==="warn");
    const strW=w.filter(c=>c.kind!=="svc");
    lvl="warn";
    tag = strW.length ? "주의" : "구조 적합 · 정비 주의";
    txt = w.map(c=>c.name).join(" · ")+" 확인 필요";
  }else{
    lvl="ok"; tag="적합";
    txt="검토 항목 전부 통과 · "+(margin>=STRIP_SF?"볼트 목 파단 지배":"");
    txt=txt.replace(/ · $/,"");
  }

  return{d,p,As,cls,C,H,M,K,mu,Klo,Khi,kf:F_,washer,washerSel,washerOn,washerIgnored,Fy,Fu,FuHead,Fwant,Fhead,Feff,Flo,Fhi,Fserv,Freq,
         Fstrip,Ats,LeMin,LeOk,LeReach,LeAssume,LeShow,reachLimited,reachCapped,
         okPossible,threads,margin,limited,hasLe,Le:o.Le,
         L,Tfric,Tadh,Trem,remRatio,adhBase,
         Trec,Tbreak,sigma,tau,sigEq,util,Db,dLoad,pBear,pRatio,
         headH,shortCs,Lu,Lk,Lbore,ls,lg,slv,shankOn,dS,dP,phi,Fz,
         embedCalc,embedCapped,embedUse,useEmbed,usePhi,turnDeg,Fsa,sigMax,len:o.len,
         checks,lvl,tag,txt,nBad,nWarn,thinRegime,loadType:o.loadType,load:o.load};
}

/* ══════════════════════════════════════════════════════════
   사양 문자열 파싱
   ══════════════════════════════════════════════════════════ */
function parse(raw){
  let s=(raw||"").trim().toLowerCase().replace(/\s+/g," ");
  if(!s)return{err:"사양을 입력하세요."};
  const out={head:null,assumed:[]};
  if(/sems|셈스|와셔일체/.test(s)){out.head="sems";s=s.replace(/sems|셈스|와셔일체/g," ");}
  if(/저두|low\s*head|lowhead|\blh\b/.test(s)){out.head="low";s=s.replace(/저두|low\s*head|lowhead|\blh\b/g," ");}
  else if(/접시|csk?|flat/.test(s)){out.head="cs";s=s.replace(/접시|csk?|flat/g," ");}
  else if(/버튼|button|btn/.test(s)){out.head="btn";s=s.replace(/버튼|button|btn/g," ");}
  s=s.replace(/[()]/g," ").replace(/수정|기준/g," ").replace(/\s+/g," ").trim();
  const m=s.match(/m\s*(\d+(?:\.\d+)?)/);
  if(!m)return{err:"호칭경을 찾을 수 없습니다. 예: M5-12"};
  out.d=parseFloat(m[1]);
  if(out.d<1.6||out.d>24)return{err:"M1.6 ~ M24 범위만 지원합니다."};
  const rest=s.slice(m.index+m[0].length);
  const pm=rest.match(/^\s*[x×*]\s*(\d+(?:\.\d+)?)/);
  if(pm)out.pitch=parseFloat(pm[1]);
  else{
    out.pitch=PITCH[out.d];
    if(!out.pitch){
      const k=Object.keys(PITCH).map(Number).sort((a,b)=>Math.abs(a-out.d)-Math.abs(b-out.d));
      out.pitch=PITCH[k[0]];out.assumed.push("피치 추정");
    }
  }
  if(out.pitch<=0||out.pitch>out.d/2)return{err:"피치 값이 유효하지 않습니다."};
  const lm=rest.match(/[-–—]\s*(\d+(?:\.\d+)?)/)||rest.match(/\s(\d+(?:\.\d+)?)\s*$/);
  out.len=lm?parseFloat(lm[1]):null;
  /* 길이도 상한을 걸어야 한다 — 오타 한 자리가 물림 슬라이더 전체 축척을 망가뜨리고,
     터무니없이 긴 볼트는 뽑힘 여유를 무한히 키워 "적합"을 잘못 띄운다. */
  if(out.len!=null){
    const lmax=lenCapOf(out.d);
    if(out.len<=0)return{err:"길이는 0보다 커야 합니다."};
    if(out.len>lmax)return{err:"M"+out.d+" 길이는 "+lmax+"mm 이하만 지원합니다."};
  }
  if(!out.head){out.head="std";out.assumed.push("표준 머리 가정");}
  return out;
}

/* ══════════════════════════════════════════════════════════
   사내 시험 데이터 — "실체결율에 따른 볼트강도별 파단토크 비교 시험" 시트 전체

   T   : 실제 파단 토크 [N·m] · 5회 평균. null이면 파단 시험을 하지 않은 행이다
   own : 사내 권장 체결 토크 [N·m] — 시트의 "산정된 체결력 × 0.90"
         (시트 컬럼 머리말은 SS400 기준 / S45C 기준으로 갈라 적혀 있지만 두 열의 비가
          전 행 정확히 0.90이라 재질 차이가 아니라 일괄 10% 감액으로 읽는다)
   len : 볼트 길이 · tap : 탭 깊이 · Le : 체결 길이
   mat:null = 재질 미상. 시트에 행별 재질 정보가 없습니다.
   ══════════════════════════════════════════════════════════ */
const MEAS_N=5;                       // 파단 토크는 5회 평균값
const MEAS=[
 {use:"Wing Tip Plate (A-seg)",  d:4, head:"cs",  len:10, tap:8.1, Le:7.5, own:3.6,  T:null, mat:null},
 {use:"Battery Bracket",         d:4, head:"std", len:12, tap:3,   Le:9.0, own:5.7,  T:null, mat:null},
 {use:"Battery Bracket",         d:4, head:"std", len:10, tap:7,   Le:7.0, own:5.7,  T:null, mat:null},
 {use:"Caster",                  d:4, head:"std", len:14, tap:10,  Le:10.0,own:5.7,  T:null, mat:null},
 {use:"Tension Block",           d:4, head:"std", len:20, tap:10,  Le:7.4, own:5.7,  T:10.50,mat:null},
 {use:"Rear Side Cover LED",     d:4, head:"cs",  len:10, tap:5,   Le:5.0, own:3.6,  T:6.59, mat:null},
 {use:"E-Box (Front)",           d:5, head:"std", len:10, tap:8,   Le:8.0, own:12.4, T:null, mat:null},
 {use:"E-Box (Front)",           d:5, head:"std", len:12, tap:12,  Le:12.0,own:12.4, T:null, mat:null},
 {use:"E-Box (Front)",           d:5, head:"std", len:12, tap:10,  Le:9.5, own:12.4, T:null, mat:null},
 {use:"Worm gear pully plate",   d:5, head:"std", len:12, tap:10,  Le:9.0, own:12.4, T:null, mat:null},
 {use:"Planet Reducer",          d:5, head:"std", len:15, tap:7,   Le:7.0, own:12.4, T:23.00,mat:null},
 {use:"Motor → Planet Reducer",  d:5, head:"std", len:20, tap:8,   Le:5.0, own:11.4, T:21.20,mat:null},
 {use:"Planet Reducer Pulley",   d:5, head:"std", len:45, tap:16,  Le:12.0,own:13.2, T:24.46,mat:null},
 {use:"Front/Rear Panel",        d:5, head:"cs",  len:6,  tap:2,   Le:2.0, own:3.1,  T:6.40, mat:null},
 {use:"Front/Rear Panel",        d:5, head:"cs",  len:14, tap:10,  Le:9.5, own:6.2,  T:null, mat:null},
 {use:"Worm gear pully plate",   d:5, head:"std", len:15, tap:12.5,Le:8.0, own:12.4, T:null, mat:null},
 {use:"Plate → Squal Nut",       d:6, head:"std", len:30, tap:8,   Le:8.0, own:22.6, T:41.78,mat:null},
 {use:"Front/Rear Driving Mod.", d:6, head:"cs",  len:20, tap:12,  Le:11.0,own:15.5, T:28.76,mat:null},
 {use:"Front/Rear Driving Mod.", d:6, head:"cs",  len:20, tap:5,   Le:5.0, own:15.5, T:28.64,mat:null},
 {use:"Worm Gear Top plate",     d:8, head:"low", len:12, tap:10,  Le:9.0, own:29.9, T:null, mat:null},
 {use:"Worm Gear Top plate",     d:8, head:"low", len:15, tap:15,  Le:12.0,own:29.9, T:null, mat:null},
 {use:"Fork Bar (A-seg)",        d:8, head:"std", len:16, tap:10,  Le:9.6, own:49.8, T:92.30,mat:null},
 {use:"Caster",                  d:8, head:"std", len:20, tap:8,   Le:7.0, own:45.8, T:84.90,mat:null},
 {use:"Worm Gear → Frame",       d:10,head:"low", len:20, tap:15,  Le:12.2,own:43.2, T:79.98,mat:null},
 {use:"전장박스 TAP",             d:3, head:"sems",len:6,  tap:2,   Le:2.0, own:0.9,  T:1.47, mat:"SPCC", cls:"A2-70", k:"sus"},
 {use:"전장박스 TAP",             d:4, head:"sems",len:10, tap:2,   Le:2.0, own:1.2,  T:2.04, mat:"SPCC", cls:"A2-70", k:"sus"}
];
/* 시트에 기록되지 않은 항목의 대체값 — 예상값에 그대로 들어가므로 화면에 표기한다.
   강도구분은 파단 하중을 1.5배까지 흔들고, 체결 조건은 K를 통해 토크에 직접 곱해진다. */
const MEAS_ASSUME={cls:"12.9",k:"dry"};
/* 예측값은 사용자 설정과 무관한 상수 — 최초 1회만 계산 */
const MEAS_PRED = MEAS.map(m=>{
  const base={d:m.d,pitch:PITCH[m.d],cls:m.cls||MEAS_ASSUME.cls,head:m.head,k:m.k||MEAS_ASSUME.k,
              washer:"none",preload:70,Le:m.Le,len:m.len,loadType:"none",load:0};
  /* 가정으로 채운 항목 목록 — 행마다 무엇이 기록되지 않았는지 보여주기 위해 남긴다 */
  const gaps=[];
  if(!m.mat)gaps.push("재질");
  if(!m.cls)gaps.push("강도구분 "+MEAS_ASSUME.cls);
  if(!m.k)  gaps.push("체결조건 μ"+KF[MEAS_ASSUME.k].mu);
  const dv=(pred)=>m.T!=null?(pred/m.T-1)*100:null;
  if(m.mat){
    const r=compute(Object.assign({},base,{mat:m.mat}));
    return {known:true, gaps, T:r.Tbreak, rec:r.Trec, lim:r.limited, dev:dv(r.Tbreak)};
  }
  const a=compute(Object.assign({},base,{mat:"S45C"}));
  const b=compute(Object.assign({},base,{mat:"SS400"}));
  const hi=a.Tbreak, lo=b.Tbreak;
  /* 물림이 넉넉하면 볼트가 먼저 파단하므로 모재를 몰라도 예상값이 같다.
     그런 행까지 "산출 불가"로 두면 쓸 수 있는 대조를 스스로 버리는 셈이다. */
  if(Math.abs(hi-lo) < hi*0.005)
    return {known:true, boltGov:true, gaps, T:hi, rec:a.Trec, lim:a.limited, dev:dv(hi)};
  return {known:false, gaps, hi, lo, rec:a.Trec, lim:a.limited};
});

/* ══════════════════════════════════════════════════════════
   상태 · 유틸
   ══════════════════════════════════════════════════════════ */
const $=id=>document.getElementById(id);
const f1=n=>n.toFixed(1), f2=n=>n.toFixed(2);
const f0=n=>Math.round(n).toLocaleString();
/* 유효숫자 3자리 — 과잉 정밀도 방지 */
const sig3=n=>{ if(!isFinite(n))return"—";
  const a=Math.abs(n);
  return a>=100?n.toFixed(0):a>=10?n.toFixed(1):n.toFixed(2); };
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

const S={spec:"M5-12",cls:"12.9",head:"std",mat:"S45C",k:"dry",washer:"none",lock:"none",
         preload:70,Le:0,loadType:"none",load:0,headAuto:true,
         shank:0,slevel:"embed",     // shank 0 = 비나사부 미고려
         lenSlider:true,             // 볼트 길이도 슬라이더로 조절할지 (선택 · 기본 켜짐)
         grip:0};                    // 유지되는 체결 두께 — 길이를 바꾸면 물림이 이걸 기준으로 따라온다
let R=null,P=null,lastDigits="",lastLvl=null,lastIcon=null,lastChkKey=null;

/* ── 상태 저장 ───────────────────────────────────────────
   현장에서 같은 체결부를 반복해 보는 도구다. 새로 고칠 때마다 M5-12·S45C로
   돌아가면 매번 다시 세팅해야 한다. 저장값은 표에서 사라졌을 수 있으니
   키 존재를 하나씩 확인하고 받는다 — 못 믿을 입력으로 취급한다. */
/* v2 — grip의 뜻이 바뀌었다(머리 밑 원통 구간 → 체결 두께 Lk). v1 값을 그대로 읽으면
   접시머리에서 물림이 머리 높이만큼 조용히 어긋나므로 키를 올려 새로 시작한다. */
const LS_KEY="torque-tak/v2";
let saveT=null;
function saveState(){
  try{localStorage.setItem(LS_KEY,JSON.stringify(S));}catch(e){}
}
function queueSave(){ clearTimeout(saveT); saveT=setTimeout(saveState,400); }
function loadState(){
  let raw=null;
  try{raw=localStorage.getItem(LS_KEY);}catch(e){return;}
  if(!raw)return;
  let o=null;
  try{o=JSON.parse(raw);}catch(e){return;}
  if(!o||typeof o!=="object")return;
  const pick=(k,tbl)=>{if(typeof o[k]==="string"&&tbl[o[k]])S[k]=o[k];};
  const num =(k,max)=>{const v=+o[k]; if(isFinite(v)&&v>=0&&v<=max)S[k]=v;};
  if(typeof o.spec==="string"&&o.spec.length<=40)S.spec=o.spec;
  pick("cls",CLS); pick("head",HEAD); pick("mat",MAT); pick("k",KF);
  pick("washer",WASHER); pick("lock",LOCK);
  if(PL_SEG.indexOf(+o.preload)>=0)S.preload=+o.preload;
  if(typeof o.slevel==="string"&&SLV_RANK[o.slevel]!=null)S.slevel=o.slevel;
  if(LOAD_SEG.some(x=>x.v===o.loadType))S.loadType=o.loadType;
  num("Le",400); num("grip",400); num("shank",400); num("load",1e7);
  S.headAuto = !!o.headAuto;
  S.lenSlider= o.lenSlider!==false;
  if(S.loadType==="none")S.load=0;              // 해제 상태와 값이 어긋나지 않게
}

const IC={
  ok:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  warn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 6v8M12 18.2v.2"/></svg>',
  bad:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  na:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 12h12"/></svg>'
};

/* ══════════════════════════════════════════════════════════
   렌더
   ══════════════════════════════════════════════════════════ */
function render(fast){
  P=parse(S.spec);
  const pr=$("parse");
  if(!fast){ pr.innerHTML=""; $("clearBtn").classList.toggle("show",S.spec.length>0); }

  if(P.err){
    $("err").textContent=P.err; $("err").hidden=false;
    setState("idle"); $("digits").textContent="—"; lastDigits="";
    $("bandWrench").textContent=""; $("bandForce").textContent="";
    $("vTitle").textContent="사양 입력 필요"; $("vDesc").textContent="";
    $("vIcon").innerHTML=IC.na; lastIcon=null;   // 직접 덮었으니 가드도 풀어둬야 복구된다
    ["sForce","sUtil","sBreak","leRead"].forEach(i=>$(i).textContent="—");
    $("draw").innerHTML=""; $("chkList").innerHTML=""; $("chkTags").innerHTML="";
    lastChkKey=null;                             // 목록을 비웠으니 가드도 풀어야 복구된다
    buildQuick(); return;
  }
  $("err").hidden=true;
  if(S.headAuto&&P.head)S.head=P.head;
  /* 볼트 길이 우선 — 길이가 바뀌면 판재(체결 두께)는 그대로 두고 물림이 따라온다.
     길이 슬라이더·사양 직접 편집·머리 형상 변경이 전부 여기로 모인다. */
  if(P.len!=null&&S.Le>0){
    /* S.grip은 체결 두께 Lk(판재 두께)다. 접시는 카운터싱크가 판재 안에 들어가므로
       판재가 머리 높이보다 얇을 수는 없다 — 그게 grip의 바닥이다. */
    const hh=headHOf();
    if(S.grip<hh)S.grip=hh;
    if(S.grip>P.len)S.grip=P.len;
    S.Le=Math.max(0,Math.round((P.len-S.grip)*100)/100);
    /* 나사부보다 깊게 물릴 수는 없다 — 넘치면 그만큼이 판재로 간다 */
    const cap=leCap();
    if(S.Le>cap+0.005){
      S.Le=Math.max(0,Math.round(cap*100)/100);
      S.grip=Math.max(0,Math.round((P.len-S.Le)*100)/100);
    }
  }

  R=compute({d:P.d,pitch:P.pitch,cls:S.cls,head:S.head,mat:S.mat,k:S.k,washer:S.washer,lock:S.lock,
             preload:S.preload,Le:S.Le,loadType:S.loadType,load:S.load,
             len:P.len,shank:S.shank,slevel:S.slevel});

  if(!fast){
    const chip=(t,c)=>{const e=document.createElement("span");e.className="pill"+(c?" "+c:"");e.textContent=t;pr.appendChild(e);};
    chip("M"+P.d+" × P"+P.pitch,"b");
    chip("As "+f2(R.As)+" mm²");
    chip(R.H.label);
    chip(R.cls+(R.H.rl?" · 머리 감액":""),R.H.rl?"w":"");
    if(S.washer!=="none")chip("와셔 "+WASHER[S.washer].label+(R.washerIgnored?" · 무시됨":""),R.washerIgnored?"w":"");
    /* 비나사부를 넣으면 길이가 그립 계산에 실제로 쓰인다 */
    chip(P.len==null?"길이 미지정"
        :R.shankOn?"길이 "+P.len+" · 그립 "+R.Lk.toFixed(1)+" mm"
        :"길이 "+P.len+" · 토크 무관", R.shankOn?"b":"mute");
    P.assumed.forEach(t=>chip(t,"w"));
  }

  setState(R.lvl);
  setDigits(sig3(R.Trec));
  $("bandWrench").innerHTML="토크렌치 ±10% → <b>"+sig3(R.Trec*.9)+" ~ "+sig3(R.Trec*1.1)+"</b> N·m";
  $("bandForce").innerHTML="실제 축력은 마찰 산포로 <b>"+f0(R.Flo)+" ~ "+f0(R.Fhi)+" N</b> 범위";

  $("verdict").classList.toggle("idle",R.lvl==="idle");
  $("vTitle").textContent=R.tag;
  $("vDesc").textContent=R.txt;
  if(R.lvl!==lastIcon){                 // 아이콘은 판정이 바뀔 때만 다시 만든다
    lastIcon=R.lvl;
    $("vIcon").innerHTML=R.lvl==="ok"?IC.ok:R.lvl==="bad"?IC.bad:R.lvl==="warn"?IC.warn
      :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5.5v13M6.5 13l5.5 5.5L17.5 13"/></svg>';
    $("vIcon").querySelectorAll("path").forEach(p=>p.setAttribute("stroke","#fff"));
  }

  $("sForce").innerHTML=f0(R.Feff)+'<small>N</small>';
  $("sUtil").innerHTML=(R.util*100).toFixed(0)+'<small>%</small>';
  $("sBreak").innerHTML=sig3(R.Tbreak)+'<small>N·m</small>';

  /* 볼트 길이 슬라이더는 선택 — 켰을 때만 두 줄짜리 레이아웃이 된다 */
  const lo=lenOn();
  $("lenWrap").hidden=!lo;
  $("lenTgl").textContent=lo?"볼트 길이 슬라이더 끄기":"볼트 길이도 슬라이더로 조절";
  if(lo){
    $("lenRead").textContent=P.len!=null?P.len+" mm":"사양에 길이 없음";
    $("leRead2").textContent=R.hasLe?f1(R.Le)+" mm":"미설정";
  }
  /* 체결 두께는 언제나 유도값 — "길이 12인데 물림 6.2"의 나머지가 어디 갔는지 보여준다 */
  $("gripRow").hidden=R.Lk==null;
  if(R.Lk!=null)$("gripRead").textContent=f1(Math.max(0,R.Lk))+" mm";
  /* 비나사부에 맞춘 물림 제안 — 이미 그 값이면 띄우지 않는다 */
  const fit=leFit(), showFit=fit!=null&&Math.abs(fit-S.Le)>0.05;
  $("leFit").hidden=!showFit;
  if(showFit)$("leFit").innerHTML="판재 두께를 비나사부 "+f1(S.shank)
    +" mm에 맞추면 물림은 <b>"+f1(fit)+" mm</b> — 눌러서 적용";
  $("leRead").textContent=R.hasLe?f1(R.Le)+" mm · Le/d "+f2(R.Le/R.d):"미설정";
  const cap=leCap(), atCap=isFinite(cap)&&R.hasLe&&S.Le>=cap-0.05;
  $("leNote").textContent =
      !R.okPossible ? "다른 검토 항목이 막고 있어 Le만으로는 적합해지지 않습니다"
    : atCap         ? (S.shank>0
                        ? "비나사부 "+f1(S.shank)+" + 불완전 나사 "+f1(2*R.p)+" mm — 물림은 "+f1(cap)+" mm까지입니다"
                        : "볼트 길이 "+P.len+" mm 안에서 물림은 "+f1(cap)+" mm까지입니다")
    : R.hasLe       ? R.threads.toFixed(1)+"산 물림 · 최소 "+f1(R.LeMin)+" / 적합 "+f1(R.LeOk)+" mm"
    /* 미설정이어도 무엇을 가정하고 토크를 냈는지는 밝힌다 */
    : R.reachCapped ? "볼트 길이로 물릴 수 있는 최대 "+f1(R.LeShow)+" mm를 가정했습니다 — 밀어서 실제 값으로"
    : R.LeAssume!=null
                    ? "적합 기준 "+f1(R.LeShow)+" mm 물림 가정 — 밀어서 실제 값으로"
    :                 "밀어서 실제 물림 길이를 맞추세요";
  $("leReset").hidden=!R.hasLe;

  renderChecks(); renderRemoval();
  /* 트랙 폭은 캐시를 쓴다. clientWidth를 읽으면 레이아웃이 강제 재계산되고, 이 문서에서는
     그 한 번이 전체 렌더의 60%였다(7.3ms 중 4.4ms). 폭이 바뀔 수 있는 때 —
     리사이즈·슬라이더 펼침·최초 렌더 — 에만 measure=true로 부른다. */
  updateSlider(false); drawSection();
  if(fast) return;                      // 드래그 중에는 여기서 종료
  buildQuick(); buildSegs(); ensureChipVisible();
  $("vMat").textContent=MAT[S.mat].label;
  $("vHead").textContent=HEAD[S.head].label;
  $("vK").textContent=KF[S.k].label;
  $("vWasher").textContent=WASHER[S.washer].label;
  $("vLock").textContent=LOCK[S.lock].label;
  $("loadClr").hidden=S.loadType==="none";
  updateShankUI();
  writeBasis(); fillMeas();
  queueSave();
}

/* 비나사부 블록 — 입력이 있을 때만 해석 수준을 노출하고, 왜 못 쓰는지도 알려준다 */
function updateShankUI(){
  const on=S.shank>0;
  const was=$("slvWrap").hidden;
  $("shankClr").hidden=!on;
  $("slvWrap").hidden=!on;
  if(!on)return;
  /* 숨은 동안은 폭이 0이라 인디케이터가 못 잡힌다 — 펼친 직후 다시 재보정 */
  if(was){segsStale(["segSlv"]);buildSegs();}
  const desc=SLV_SEG.find(o=>o.v===S.slevel);
  let note=desc?desc.desc:"";
  if(R){
    if(R.len==null) note="볼트 길이를 입력해야 체결 두께를 알 수 있습니다 — 예: M5-12";
    else if(!R.hasLe) note="물림 깊이 Le를 설정해야 체결 두께를 알 수 있습니다";
    else if(!R.shankOn) note="볼트 원통부가 판재 안에 남는 구간이 0입니다 — 비나사부가 들어갈 자리가 없습니다"
      +(R.H.cone?" (접시는 카운터싱크가 그 자리를 먼저 씁니다)":"");
    else if(SLV_RANK[S.slevel]>=1&&!R.useEmbed) note="이 형상에서는 부재 강성을 구할 수 없습니다 — 기하 검사만 적용됩니다";
    else if(R.useEmbed){
      note=desc.desc+" · 현재 이완 손실 "+(R.embedUse*100).toFixed(1)+"%"
          +(R.embedCapped?" — 모델 상한 50%에 걸렸습니다":" (고정값 10% 대신)");
      /* 접시는 좌면 면압을 못 구하면서 강성은 구한다 — 그 가정을 여기서도 밝힌다 */
      if(R.H.cone)note+=" · 접시는 하중 도입 지름을 이론 머리 지름 2.24d로 가정";
    }
  }
  $("slvDesc").textContent=note;
}

function setState(lvl){
  /* :root 커스텀 프로퍼티를 건드리면 이걸 쓰는 문서 전체가 스타일 재계산에 들어간다.
     드래그 중에는 판정이 그대로인 프레임이 대부분이라 바뀔 때만 쓴다. */
  if(lvl===lastLvl)return;
  lastLvl=lvl;
  const map={ok:["var(--ok)","var(--ok-tint)"],warn:["var(--warn)","var(--warn-tint)"],
             bad:["var(--ng)","var(--ng-tint)"],idle:["var(--ink)","var(--surface-2)"]};
  const [c,t]=map[lvl]||map.idle;
  document.documentElement.style.setProperty("--st",c);
  document.documentElement.style.setProperty("--st-tint",t);
}

function setDigits(str){
  const el=$("digits");
  if(str===lastDigits)return;
  const prev=lastDigits; lastDigits=str; el.innerHTML="";
  for(let i=0;i<str.length;i++){
    const s=document.createElement("span");
    s.textContent=str[i];
    if(str[i]===".")s.className="pt";
    if(prev[i]!==str[i])s.classList.add("roll");
    el.appendChild(s);
  }
}

function renderRemoval(){
  const card=$("remCard");
  if(!R||!R.Trem){card.hidden=true;return;}
  card.hidden=false;
  const L=R.L;
  $("remGrade").textContent=L.label+" · "+(L.red?"고강도":L.bk>=12?"중강도":"저강도");
  $("remGrade").className="rem-tag"+(L.red?" red":" blue");
  $("remVal").textContent=sig3(R.Trem);
  $("remRange").textContent="산포 감안 "+sig3(R.Trem*0.7)+" ~ "+sig3(R.Trem*1.3)+" N·m · 체결 토크의 "
    +(R.Trem/R.Trec).toFixed(2)+"배";
  $("remFric").textContent=sig3(R.Tfric);
  $("remAdh").textContent=sig3(R.Tadh);
  const r=R.remRatio, bar=$("remBar");
  bar.style.width=Math.min(100,r*100)+"%";
  bar.className=r>0.9?"b":r>0.7?"w":"";
  $("remMark").style.left="90%";
  const foot=$("remFoot");
  if(r>0.9){
    foot.className="rem-foot bad";
    foot.innerHTML="볼트 예상 파단 <b>"+sig3(R.Tbreak)+" N·m</b>의 "+(r*100).toFixed(0)
      +"% — 공구로 풀면 볼트가 먼저 부러집니다."+(L.red?" 250°C 가열 분해를 전제하세요.":"");
  }else if(r>0.7){
    foot.className="rem-foot warn";
    foot.innerHTML="볼트 예상 파단 <b>"+sig3(R.Tbreak)+" N·m</b>의 "+(r*100).toFixed(0)+"% — 여유가 크지 않습니다.";
  }else{
    foot.className="rem-foot";
    foot.innerHTML="볼트 예상 파단 <b>"+sig3(R.Tbreak)+" N·m</b>의 "+(r*100).toFixed(0)+"% — 표준 공구로 분해 가능."
      +(R.M.act<1?" 단, 비활성 모재라 실제 강도는 더 낮을 수 있습니다.":"");
  }
  if(R.d<6) foot.innerHTML+=' <span style="color:var(--ink-3)">M6 미만은 TDS 실측 구간 밖이라 외삽값입니다.</span>';
  /* 271·272는 프리베일링 토크가 이탈 토크보다 커서 그쪽을 쓴다 — 라벨만 보고
     "이탈 토크"로 읽으면 TDS 값과 대조가 안 맞는다 */
  if(R.adhBase==="pv")
    foot.innerHTML+=' <span style="color:var(--ink-3)">'+L.label+'은 프리베일링 토크 '+L.pv
      +' N·m가 이탈 '+L.bk+'보다 커서 큰 쪽으로 잡았습니다.</span>';
  foot.innerHTML+=srcTag("tds","iso4032","own");
}

function renderChecks(){
  /* 드래그 중에는 검토 결과가 그대로인 프레임이 대부분이다. 목록 전체를 다시 만드는
     비용이 프레임 예산에서 가장 크므로 내용이 바뀔 때만 다시 만든다. */
  const key=R.checks.map(c=>c.lvl+""+c.name+""+c.val+""+c.detail).join("");
  if(key===lastChkKey)return;
  lastChkKey=key;
  const list=$("chkList"), tags=$("chkTags");
  list.innerHTML=""; tags.innerHTML="";
  const n={ok:0,warn:0,bad:0,na:0};
  /* 같은 대응 묶음을 여러 항목이 공유하면(뽑힘·나사산 수) 첫 항목에만 펼친다 */
  const shownFix=new Set();
  R.checks.forEach(c=>{
    n[c.lvl]++;
    const el=document.createElement("div");
    el.className="chk chk-"+c.lvl;
    /* 대응 방법은 설계 NG일 때만 — 주의 단계까지 펼치면 목록이 읽히지 않는다 */
    let fix="";
    if(c.lvl==="bad"&&c.fix&&!shownFix.has(c.fix)){
      shownFix.add(c.fix);
      fix=`<div class="chk-fix"><em>이렇게 대응하세요</em><ol>`
        +c.fix.map(t=>`<li>${esc(t)}</li>`).join("")+`</ol></div>`;
    }
    el.innerHTML=`<span class="chk-ic">${IC[c.lvl]}</span>
      <div class="chk-t"><b>${esc(c.name)}</b><span>${esc(c.detail)}</span>${fix}</div>
      <span class="chk-v">${esc(c.val)}</span>`;
    list.appendChild(el);
  });
  const t=(cls,txt)=>{const e=document.createElement("span");e.className="ctag "+cls;e.textContent=txt;tags.appendChild(e);};
  if(n.bad)t("bad",n.bad+" NG");
  if(n.warn)t("warn",n.warn+" 주의");
  if(n.ok)t("ok",n.ok+" 적합");
}

/* ══════════════════════════════════════════════════════════
   퀵칩 · 세그먼트
   ══════════════════════════════════════════════════════════ */
function buildQuick(){
  const q=$("quick");
  if(q.dataset.built==="1"){
    q.querySelectorAll("[data-d]").forEach(b=>b.classList.toggle("on",P&&!P.err&&+b.dataset.d===P.d));
    q.querySelectorAll("[data-h]").forEach(b=>b.classList.toggle("on",b.dataset.h===S.head));
    return;
  }
  q.innerHTML="";
  SIZES.forEach(d=>{
    const b=document.createElement("button");
    b.className="qchip"; b.dataset.d=d; b.textContent="M"+d;
    b.onclick=()=>{const len=P&&P.len!=null?"-"+P.len:"";
      const h=S.head!=="std"?" "+HEAD[S.head].label.replace(" CS",""):"";
      S.spec="M"+d+h+len; $("spec").value=S.spec; S.headAuto=true; render();};
    q.appendChild(b);
  });
  const dv=document.createElement("div"); dv.className="qdiv"; q.appendChild(dv);
  Object.keys(HEAD).forEach(h=>{
    const b=document.createElement("button");
    b.className="qchip"; b.dataset.h=h; b.textContent=HEAD[h].label;
    b.onclick=()=>{S.head=h;S.headAuto=false;render();};
    q.appendChild(b);
  });
  q.dataset.built="1";
  buildQuick();          // 클래스 토글만 하는 경로로 다시 들어간다
  updateQuickNav();      // 칩 폭이 확정된 직후 한 번만 — 이후로는 스크롤·리사이즈에서만 잰다
}

/* 가로 스크롤 상태 → 페이드·화살표 노출 제어 */
function updateQuickNav(){
  const q=$("quick"), w=$("quickWrap");
  if(!q||!w)return;
  const slack=q.scrollWidth-q.clientWidth;
  w.classList.toggle("can-l",slack>2 && q.scrollLeft>2);
  w.classList.toggle("can-r",slack>2 && q.scrollLeft<slack-2);
}
/* 선택된 칩이 잘려 있으면 보이는 위치로 (페이지 스크롤 건드리지 않음).
   호칭경이 바뀔 때만 — 그대로면 offsetLeft를 읽지 않고, 사용자가 손으로 옮긴
   스크롤 위치를 렌더마다 되돌리지도 않는다. */
let lastChipD=null, chipRAF=null;
function ensureChipVisible(){
  const q=$("quick"); if(!q)return;
  const el=q.querySelector(".qchip.on[data-d]"); if(!el)return;
  if(el.dataset.d===lastChipD)return;
  lastChipD=el.dataset.d;
  /* 읽기를 프레임 뒤로 — 그 시점에는 브라우저가 레이아웃을 이미 끝내 놓아 공짜다 */
  if(chipRAF)cancelAnimationFrame(chipRAF);
  chipRAF=requestAnimationFrame(()=>{chipRAF=null;scrollChipIntoView();});
}
function scrollChipIntoView(){
  const q=$("quick"); if(!q)return;
  const el=q.querySelector(".qchip.on[data-d]"); if(!el)return;
  const l=el.offsetLeft, r=l+el.offsetWidth, pad=46;
  if(l<q.scrollLeft+pad) q.scrollTo({left:Math.max(0,l-pad),behavior:"smooth"});
  else if(r>q.scrollLeft+q.clientWidth-pad) q.scrollTo({left:r-q.clientWidth+pad,behavior:"smooth"});
}
(function quickNav(){
  const q=$("quick");
  const step=dir=>{
    const d=Math.max(120,q.clientWidth*0.7);
    q.scrollTo({left:q.scrollLeft+dir*d,behavior:"smooth"});
  };
  $("qPrev").onclick=()=>step(-1);
  $("qNext").onclick=()=>step(1);
  q.addEventListener("scroll",updateQuickNav,{passive:true});
})();

function buildSegs(){
  seg("segCls","indCls",CLS_SEG,S.cls,v=>CLS[v].label,v=>{S.cls=v;render();});
  seg("segPl","indPl",PL_SEG,S.preload,v=>v+"%",v=>{S.preload=+v;render();});
  seg("segLoad","indLoad",LOAD_SEG.map(o=>o.v),S.loadType,
      v=>LOAD_SEG.find(o=>o.v===v).label,
      v=>{S.loadType=v; if(v==="none"){S.load=0;$("load").value="";} render();});
  /* 숨어 있으면 폭이 0이라 위치를 못 잡는다 — 펼칠 때 updateShankUI가 다시 부른다 */
  if(!$("slvWrap").hidden)
    seg("segSlv","indSlv",SLV_SEG.map(o=>o.v),S.slevel,
        v=>SLV_SEG.find(o=>o.v===v).label,
        v=>{S.slevel=v;render();});
}
function seg(id,indId,items,cur,lbl,cb){
  const el=$(id);
  if(el.dataset.built!=="1"){
    items.forEach(v=>{
      const b=document.createElement("button");
      b.textContent=lbl(v); b.dataset.v=v;
      b.onclick=()=>cb(v);
      el.appendChild(b);
    });
    el.dataset.built="1";
  }
  const btns=[...el.querySelectorAll("button")];
  let idx=-1;
  btns.forEach((b,i)=>{
    const on=String(items[i])===String(cur);
    if(on)idx=i;
    b.classList.toggle("on",on);
  });
  if(idx<0)return;
  /* 버튼 위치를 캐시한다. offsetLeft를 읽으면 직전 쓰기 때문에 레이아웃이 그 자리에서
     다시 계산되고, 이 문서에서는 그 한 번이 8ms였다. .on은 색만 바꾸고 버튼은
     flex:1 + border-box라 폭이 고정이므로 한 번 재두면 계속 쓸 수 있다.
     폭이 바뀔 수 있는 때(리사이즈·펼침)에만 segsStale()로 버린다. */
  let g=SEGGEO[id];
  if(!g) g=SEGGEO[id]=btns.map(b=>[b.offsetLeft,b.offsetWidth]);
  const ind=$(indId);
  ind.style.left=g[idx][0]+"px"; ind.style.width=g[idx][1]+"px";
}
const SEGGEO={};
/* 폭이 바뀌었을 수 있으니 캐시를 버린다 */
function segsStale(ids){ (ids||Object.keys(SEGGEO)).forEach(id=>{delete SEGGEO[id];}); }

/* ══════════════════════════════════════════════════════════
   단면도
   ══════════════════════════════════════════════════════════ */
/* SVG 속성에는 var()를 쓸 수 없어 CSS 토큰과 같은 값을 여기 한 번만 적어 둔다.
   styles.css의 --ink-3 / --ng / --warn / --ok 를 바꾸면 여기도 함께 바꿔야 한다. */
const DC={ink3:"#64738A", dim:"#5E7290", ng:"#C42317", warn:"#A25F00", ok:"#0A7A50"};
function drawSection(){
  if(!R){$("draw").innerHTML="";return;}
  const W=340,cy=88;
  const plateL=52;
  const rMaj=Math.max(8,Math.min(17,6+R.d*0.9));
  const cap=rMaj*1.45, bh=Math.max(30,rMaj+13);
  /* 접시머리에는 와셔를 그리지 않는다 — 계산에서 무시한 것을 그림으로 되살리면 안 된다 */
  const wOn=R.washerOn;
  const wThk=wOn?5:0;
  const wRad=wOn?Math.min(bh-2,Math.max(cap*1.25,rMaj*WASHER[R.washer].dhr*0.55)):0;
  const hw=R.H.cone?0:(S.head==="low"?9:16);
  const headR=plateL-wThk;                     // 머리 우측 끝
  const Le=R.LeShow;                           // 미설정이면 길이로 제한된 가정값
  const idle=!R.hasLe;

  /* ── 가로 축척 ────────────────────────────────────────
     볼트 길이 = 체결 두께 + 물림이므로 "부재 박스 고정 + 물림 폭이 Le에 비례 +
     볼트 길이 일정"은 동시에 성립하지 않는다. 셋 중 물림 폭을 포기한 배치다.
     · 두 부재 박스는 고정 — 값을 바꿔도 자리를 옮기지 않는다.
     · 물림 구간 폭은 Le와 무관하다. Le는 나사산 갯수와 숫자로 읽는다.
       (나사산 간격이 좁아지면 깊게 물린 것 — 갯수 = Le/피치)
     · 볼트 길이를 바꾸면 머리는 그대로 두고 나사부 박스와 볼트가 오른쪽으로 자란다.
     길이를 화면 폭에 그대로 비례시키면 짧은 볼트가 너무 작아져 나사산이 안 보이므로,
     기본 60px에 1mm당 3.2px를 더하는 식으로 압축했다(상한 248px). */
  const pw=33, pR=plateL+pw;                   // 나사산 없는 가공물 — 고정 폭
  const blkL=pR;                               // 나사부 박스 왼쪽 — 맞붙여 고정
  const prop=R.Lu!=null&&R.Lu>0;
  const span=prop?Math.max(60,Math.min(248,60+R.Lu*3.2)):248;
  const boltEnd=headR+span;                    // 볼트 끝 — 머리 고정, 끝이 늘어난다
  const eng=boltEnd-blkL;                      // 물림 구간 — 볼트 길이만의 함수
  const blkR=Math.min(W-6,boltEnd+34);         // 나사부 박스 오른쪽 — 볼트 끝보다 조금 더
  const col=idle?DC.ink3:R.lvl==="bad"?DC.ng:R.lvl==="warn"?DC.warn:DC.ok;
  const g=[]; const N=(x,y)=>x.toFixed(1)+","+y.toFixed(1);

  /* ── 부재 ──────────────────────────────────────────────
     비나사부는 값이 바뀌어도 그림이 움직이지 않는다. 박스·점선·치수선은 전부 고정
     위치이고 숫자만 바뀐다. 값에 비례해 도형을 늘렸다 줄이면 정작 봐야 할 물림
     깊이가 묻히고, 입력할 때마다 화면이 요동친다. 실제 치수 검토는 검토 항목이 한다. */
  /* 나사산 있는 가공물 (탭 모재) */
  g.push(`<rect x="${blkL}" y="${cy-bh}" width="${blkR-blkL}" height="${bh*2}" rx="8" fill="#E9EEF4"/>`);
  g.push(`<rect x="${blkL}" y="${cy-rMaj-2}" width="${eng+14}" height="${rMaj*2+4}" rx="3" fill="#F8FAFB"/>`);
  /* 나사산 없는 가공물 (클램프 판) */
  g.push(`<rect x="${plateL}" y="${cy-bh}" width="${pw}" height="${bh*2}" rx="6" fill="#DFE6EF"/>`);
  g.push(`<rect x="${plateL}" y="${cy-rMaj-2.5}" width="${pw}" height="${rMaj*2+5}" fill="#F8FAFB"/>`);
  /* 볼트 몸통 */
  g.push(`<rect x="${headR}" y="${cy-rMaj}" width="${blkL-headR+eng}" height="${rMaj*2}" rx="2.5" fill="#BCCDE6"/>`);
  if(R.shankOn){
    /* 비나사부 — 값에 비례해 늘리지 않는 짧은 고정 폭 콜아웃에 숫자만 얹는다.
       부재 박스는 그립을 채우므로 거기에 맞추면 5mm짜리 치수가 그립 전체를 덮어
       길이를 잘못 읽게 된다. 그래서 치수는 박스와 따로 둔다.
       간섭이면 색과 꼬리말만 바뀌고 도형은 그대로다. */
    const dimR=plateL+Math.min(33,pw);
    const impossible=R.Lu!=null&&R.ls>=R.Lu, over=R.Lbore!=null&&(R.ls+2*R.p)>R.Lbore;
    const c2=(over||impossible)?DC.ng:DC.dim;
    const uy=cy-bh-24;                           // 좌면 압괴 경고(cy-bh-6)보다 위
    g.push(`<path d="M${N(headR,uy-4)} L${N(headR,uy+4)} M${N(dimR,uy-4)} L${N(dimR,uy+4)}" stroke="${c2}" stroke-width="1.3" stroke-linecap="round"/>`);
    g.push(`<line x1="${headR}" y1="${uy}" x2="${dimR}" y2="${uy}" stroke="${c2}" stroke-width="1.4" stroke-linecap="round"/>`);
    g.push(`<text x="${((headR+dimR)/2).toFixed(1)}" y="${uy-6}" text-anchor="middle" font-size="10" font-weight="700" fill="${c2}">`
      +`비나사부 ${f1(R.ls)}${impossible?" — 길이 초과":over?" — 샹크 간섭":""}</text>`);
  }
  /* 와셔 */
  if(wOn) g.push(`<rect x="${plateL-wThk}" y="${cy-wRad}" width="${wThk}" height="${wRad*2}" rx="1.5" fill="#8FA6C4"/>`);
  /* 머리 */
  if(R.H.cone)
    g.push(`<polygon points="${N(headR-20,cy-cap)} ${N(headR,cy-rMaj)} ${N(headR,cy+rMaj)} ${N(headR-20,cy+cap)}" fill="#2B3A57"/>`);
  else
    g.push(`<rect x="${headR-hw}" y="${cy-cap}" width="${hw}" height="${cap*2}" rx="2.5" fill="#2B3A57"/>`);

  /* 물린 나사산 — 그릴 수 있는 점은 26개까지지만 라벨은 실제 산수를 쓴다.
     예전에는 라벨도 26에서 잘려 검토 항목이 "40.0산"인데 그림은 "26산"이라고 말했다.
     잘렸을 때는 가운데 한 칸을 비워 생략을 눈으로도 알린다. */
  const nTrue=Math.max(1,Math.round(Le/R.p));
  const n=Math.min(26,nTrue), cut=nTrue>n, skip=cut?Math.floor(n/2):-1;
  const step=eng/n, rr=Math.max(1.6,Math.min(2.7,step*0.24));
  for(let i=0;i<n;i++){
    if(i===skip)continue;
    const x=blkL+i*step+step*.5;
    g.push(`<circle cx="${x.toFixed(1)}" cy="${cy-rMaj}" r="${rr.toFixed(1)}" fill="${col}"/>`);
    g.push(`<circle cx="${x.toFixed(1)}" cy="${cy+rMaj}" r="${rr.toFixed(1)}" fill="${col}"/>`);
  }
  if(cut){
    const x=blkL+skip*step+step*.5;
    g.push(`<text x="${x.toFixed(1)}" y="${cy-rMaj+3.5}" text-anchor="middle" font-size="9" font-weight="700" fill="${DC.ink3}">⋯</text>`);
    g.push(`<text x="${x.toFixed(1)}" y="${cy+rMaj+3.5}" text-anchor="middle" font-size="9" font-weight="700" fill="${DC.ink3}">⋯</text>`);
  }
  const strip=R.hasLe&&R.margin<STRIP_SF;
  if(strip){
    g.push(`<line x1="${blkL}" y1="${cy-rMaj-5}" x2="${blkL+eng}" y2="${cy-rMaj-5}" stroke="${DC.ng}" stroke-width="1.8" stroke-dasharray="3 3" stroke-linecap="round"/>`);
    g.push(`<line x1="${blkL}" y1="${cy+rMaj+5}" x2="${blkL+eng}" y2="${cy+rMaj+5}" stroke="${DC.ng}" stroke-width="1.8" stroke-dasharray="3 3" stroke-linecap="round"/>`);
  }else if(R.hasLe){
    /* 탭 면 점선 — 위치 고정. 비나사부 값과 무관하다 */
    g.push(`<line x1="${blkL-6}" y1="${cy-rMaj-8}" x2="${blkL-6}" y2="${cy+rMaj+8}" stroke="${DC.ink3}" stroke-width="1.8" stroke-dasharray="3 3" stroke-linecap="round"/>`);
  }
  /* 좌면 압괴 경고 */
  const bear=R.checks.find(c=>c.name==="좌면 면압");
  if(bear&&bear.lvl==="bad")
    g.push(`<path d="M${N(plateL+2,cy-bh-3)} L${N(plateL+2,cy-rMaj-4)}" stroke="${DC.ng}" stroke-width="2" stroke-linecap="round" stroke-dasharray="2 3"/>`)
    ,g.push(`<text x="${plateL+6}" y="${cy-bh-6}" font-size="9.5" font-weight="700" fill="${DC.ng}">좌면 압괴</text>`);

  const modeTxt=idle?"":strip?"뽑힘 지배":"볼트 목 파단";
  g.push(`<text x="${blkL+eng/2}" y="${cy-rMaj-14}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${col}">${nTrue}산 물림${modeTxt?" · "+modeTxt:""}</text>`);

  const dy=cy+bh+18;
  g.push(`<path d="M${N(blkL,dy-5)} L${N(blkL,dy+5)} M${N(blkL+eng,dy-5)} L${N(blkL+eng,dy+5)}" stroke="${col}" stroke-width="1.4" stroke-linecap="round"/>`);
  g.push(`<line x1="${blkL}" y1="${dy}" x2="${blkL+eng}" y2="${dy}" stroke="${col}" stroke-width="1.6" stroke-linecap="round"/>`);
  g.push(`<text x="${blkL+eng/2}" y="${dy+17}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${col}">Le ${f1(Le)} mm</text>`);
  /* 미설정 상태의 Le가 기준값인지 길이 한도값인지 구분해 준다 — 8mm 볼트에
     "Le 8.8" 같은 성립 불가 치수가 뜨지 않게 하는 것이 이 표시의 요점이다 */
  if(idle)
    g.push(`<text x="${blkL+eng/2}" y="${dy+32}" text-anchor="middle" font-size="10" font-weight="600" fill="${DC.ink3}">`
      +`${R.reachCapped?"길이로 물릴 수 있는 최대 · 미설정":"적합 기준값 · 아직 미설정"}</text>`);
  if(wOn)g.push(`<text x="${plateL-2}" y="${dy+17}" text-anchor="end" font-size="10" font-weight="600" fill="${DC.dim}">${WASHER[R.washer].label}</text>`);
  /* 볼트 길이 치수 — 물림 치수 바깥쪽에 한 줄 더 (제도 관례대로 전체 치수가 아래).
     "나사 길이"로 쓰면 바로 위 비나사부 치수와 나란해져 나사부 길이로 읽힌다. */
  if(R.len!=null){
    const ly=dy+(idle?46:30), lx1=headR, lx2=blkL+eng;
    g.push(`<path d="M${N(lx1,ly-4)} L${N(lx1,ly+4)} M${N(lx2,ly-4)} L${N(lx2,ly+4)}" stroke="${DC.ink3}" stroke-width="1.3" stroke-linecap="round"/>`);
    g.push(`<line x1="${lx1}" y1="${ly}" x2="${lx2.toFixed(1)}" y2="${ly}" stroke="${DC.ink3}" stroke-width="1.4" stroke-linecap="round"/>`);
    g.push(`<text x="${((lx1+lx2)/2).toFixed(1)}" y="${ly+14}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${DC.dim}">볼트 길이 ${R.len} mm${R.H.cone?" (머리 포함)":""}</text>`);
  }
  g.push(`<text x="${W-4}" y="14" text-anchor="end" font-size="10.5" font-weight="600" fill="${DC.ink3}">${MAT[S.mat].label} · τu ${Math.round(tauOf(S.mat))} MPa</text>`);
  $("draw").innerHTML=g.join("");
}

/* ══════════════════════════════════════════════════════════
   슬라이더
   ══════════════════════════════════════════════════════════ */
/* Le 트랙 폭 — 기본은 3.2d지만, 긴 볼트에서는 길이 슬라이더가 Le를 그 위로 밀어올릴 수
   있다. 도달 가능한 최대 물림까지 덮어야 썸이 끝에 박히거나 ARIA가 범위를 벗어나지 않는다.
   연질 모재(수지·알루미늄)에서는 적합 기준선 자체가 3.2d를 넘으므로 그것도 덮는다. */
const leMax=()=>{
  if(!P||P.err)return 16;
  let m=Math.max(P.d*3.2,8);
  const reach=availLen();
  if(reach!=null)m=Math.max(m,reach);
  /* 적합 기준선까지 덮되 무한정 늘리지는 않는다. 수지 모재는 기준선이 15d를 넘어(M5 POM
     76.9mm) 트랙을 거기까지 늘리면 실무 구간이 왼쪽 7%로 뭉개져 슬라이더를 못 쓴다.
     6d에서 끊고, 넘어간 기준선은 트랙 끝에 붙여 "눈금 밖"으로 표시한다. */
  if(R&&isFinite(R.LeOk))m=Math.max(m,Math.min(R.LeOk*1.08,P.d*6));
  /* 지금 값이 트랙 밖이면 눈금을 늘려서라도 덮는다 — 안 그러면 썸이 끝에 박히고
     ARIA가 valuenow > valuemax인 범위를 읽는다. 저장값 복원처럼 밖에서 들어온
     값에 대한 마지막 방어선이다(키보드 쪽은 clampLe이 막는다). */
  if(R&&R.hasLe&&isFinite(R.Le))m=Math.max(m,R.Le);
  return m;
};

/* ── 체결부 치수 ─────────────────────────────────────────
   L = 머리 + 체결 두께 + Le. 자유도가 2라 두 값만 제어하고 나머지는 유도한다.
   볼트 길이가 우선이다 — 길이를 바꾸면 체결 두께(판재)는 그대로 두고 물림이 따라온다.
   Le 슬라이더는 반대로 길이를 두고 체결 두께를 바꾼다. */
const headHOf =()=>(P&&!P.err&&HEAD[S.head].cone)?cskHead(P.d):0;
const lenOn   =()=>S.lenSlider&&!!P&&!P.err;
const snapIn  =(list,v)=>list.reduce((a,b)=>Math.abs(b-v)<Math.abs(a-v)?b:a);
/* 머리 밑에서 쓸 수 있는 길이 = 체결 두께 + 물림 */
const availLen=()=>{
  if(!P||P.err||P.len==null)return null;
  /* 접시 머리보다 짧은 길이는 성립하지 않는다 — 음수를 흘리면 leCap이 0이 되어
     슬라이더가 이유 없이 잠긴 것처럼 보인다. null로 돌리면 검토 항목이 이유를 말한다. */
  const a=P.len-headHOf();
  return a>0?a:null;
};
/* 볼트 길이 슬라이더 상한 — 호칭경 기준으로 잡고 표준 길이에 맞춘다.
   이미 입력된 길이가 그보다 길면 그 길이까지 덮어야 한다. 안 그러면 ARIA 범위를
   벗어나고, 슬라이더를 한 번 건드린 순간 볼트가 조용히 짧아진다. */
const lenMax  =()=>{const t=Math.max(25,8*(P&&!P.err?P.d:5),
                                     (P&&!P.err&&P.len!=null)?P.len:0);
                    return BOLT_LEN.find(v=>v>=t)||BOLT_LEN[BOLT_LEN.length-1];};
/* 판재는 최소한 관통해야 하므로 이 아래로는 못 줄인다 — 슬라이더 눈금으로도 쓴다.
   물림이 미설정이면 체결 두께도 아직 뜻이 없으므로 머리 높이만 바닥으로 둔다.
   grip이 곧 체결 두께라 여기에 머리 높이를 또 더하면 안 된다. */
const lenMin  =()=>S.Le>0?Math.max(headHOf(),S.grip):headHOf();
/* 바닥을 만족하는 표준 길이 목록 — 없으면 길이를 건드리지 않는다 */
/* 바닥은 판재 관통, 천장은 사양이 받아 주는 한계 — 위를 안 자르면 화살표 키가
   BOLT_LEN 끝(200)까지 걸어가고 그 값이 사양 상한을 넘으면 오류 상태가 된다. */
const lenPicks=()=>{
  const hi=(P&&!P.err)?lenCapOf(P.d):Infinity;
  return BOLT_LEN.filter(x=>x>=lenMin()&&x<=hi);
};
/* 사양 문자열을 다시 쓰되 비표준 피치와 머리 표기는 보존한다 */
function specWithLen(len){
  const h=S.head!=="std"?" "+HEAD[S.head].label.replace(" CS",""):"";
  const pit=(P.pitch!==PITCH[P.d])?"x"+P.pitch:"";
  return "M"+P.d+pit+h+"-"+len;
}
function setBoltLen(v){
  const ok=lenPicks();
  if(!ok.length)return false;            // 판재를 관통하는 표준 길이가 없다
  const L=snapIn(ok,v);
  if(P.len===L)return false;
  S.spec=specWithLen(L); $("spec").value=S.spec;
  return true;
}
/* Le 상한 — 볼트 밖으로도, 나사가 없는 비나사부 구간으로도 물릴 수 없다.
   비나사부가 볼트보다 길면 애초에 성립하지 않는 입력이라 검토 항목이 따로 잡는다. */
function leCap(){
  const a=availLen();
  if(a==null||!S.shank)return a==null?Infinity:a;
  /* 불완전 나사부 2피치까지 빼야 나사 런아웃 검사와 기준이 맞는다 —
     안 빼면 슬라이더를 끝까지 민 순간 바로 NG가 뜬다 */
  const th=a-S.shank-2*(P.pitch||0);
  return th>0?th:a;
}
/* 볼트 길이가 없으면 물리적 상한(leCap)이 없다. 그대로 두면 화살표 키를 계속 눌러
   Le를 트랙 밖까지 밀 수 있고, 썸은 끝에 붙은 채 숫자와 나사산 수만 올라간다.
   트랙 상한을 함께 씌운다 — 길이가 있으면 leCap ≤ leMax라 동작이 달라지지 않는다. */
function clampLe(v){ return Math.max(0,Math.min(v,leCap(),leMax())); }
/* 판재 두께를 비나사부에 맞췄을 때의 물림 — 제안값.
   실무에서 부분나사 볼트를 고르는 순서가 "판재 두께 = 비나사부"이므로 값을 넣으면
   물림이 따라오는 게 자연스럽다. 다만 자동으로 덮어쓰지는 않는다 — 비나사부와 판재
   두께가 반드시 같아야 하는 것도 아니고(스페이서·카운터보어), 슬라이더로 맞춘 값이
   예고 없이 사라지면 안 된다. 그래서 버튼으로 제안만 한다.
   여유는 나사 런아웃 검토가 쓰는 10%를 그대로 써서, 제안을 눌렀는데 곧바로
   "주의"로 떨어지는 일이 없게 한다 — slack ≥ 0.1·Lk 를 만족하는 최대 물림이다. */
function leFit(){
  const a=availLen();
  if(a==null||!(S.shank>0)||!P||P.err)return null;
  const need=(S.shank+2*(P.pitch||0))/0.9;      // 여유 10% 기준을 만족하는 최소 체결 두께
  /* 내림한 뒤 슬라이더 한 칸(0.1mm)을 더 뺀다. 기준선에 딱 붙이면 부동소수 오차만으로도
     여유가 기준 아래로 떨어져, 제안을 누른 즉시 "주의"가 뜬다. */
  const v=Math.floor((a-need)*10)/10-0.1;
  return v>0.05 ? Math.min(v,leCap()) : null;
}
/* Le 슬라이더 전용 — 길이는 그대로 두고 체결 두께가 차이를 흡수한다.
   이렇게 갱신해 둬야 render의 "길이 우선" 유도와 어긋나지 않는다.
   grip은 체결 두께 Lk = 볼트 길이 − 물림. 머리 높이를 빼지 않는다. */
function setLe(v){
  S.Le=clampLe(v);
  if(P&&!P.err&&P.len!=null)S.grip=Math.max(0,Math.round((P.len-S.Le)*100)/100);
}
/* 트랙 폭 캐시 — clientWidth는 레이아웃 강제 계산이다. 드래그 중에는 스타일을 쓴
   직후 다시 읽어 프레임마다 리플로우가 두 번 일어나므로, 폭이 바뀔 수 있는 시점
   (전체 렌더·리사이즈·슬라이더 펼침)에만 재측정하고 드래그 프레임은 캐시를 쓴다. */
const TW={le:0,len:0};
function measureTracks(){
  TW.le =$("track").clientWidth||TW.le||300;
  TW.len=$("ltrack").clientWidth||TW.len||300;
}
function updateSlider(measure){
  if(!R)return;
  if(measure||!TW.le)measureTracks();
  /* 볼트 길이 트랙 — 켰을 때만. 체결 두께 0이 되는 지점을 눈금으로 찍는다 */
  if(lenOn()){
    const lt=$("ltrack"), lw=TW.len, lmax=lenMax();
    const lat=v=>Math.max(0,Math.min(1,v/lmax))*lw;
    const lpx=lat(P.len!=null?P.len:lenMin());
    $("lthumb").style.left=lpx+"px";
    $("lthumb").classList.toggle("ghost",P.len==null);
    $("lfill").style.width=(P.len!=null?lpx:0)+"px";
    $("ltickMin").style.left=lat(lenMin())+"px";
    lt.setAttribute("aria-valuenow",P.len!=null?P.len:0);
    /* 하한은 판재를 관통하는 길이라 0이 아니다 — 0으로 두면 스크린리더가 실제로 갈 수
       없는 범위를 읽어 준다 */
    lt.setAttribute("aria-valuemin",f1(lenMin()));
    lt.setAttribute("aria-valuemax",lmax);
    lt.setAttribute("aria-valuetext",(P.len!=null?P.len+"mm":"미지정")
      +", 물림 "+f1(R.LeShow)+"mm"+(R.hasLe?"":" (가정)")
      +", 체결 두께 "+(R.Lk!=null?f1(Math.max(0,R.Lk)):"—")+"mm");
  }

  const max=leMax(), t=$("track"), w=TW.le;
  const at=v=>Math.max(0,Math.min(1,v/max))*w;
  const px=at(R.LeShow);
  $("thumb").style.left=px+"px";
  $("thumb").classList.toggle("ghost",!R.hasLe);
  $("fill").style.width=(R.hasLe?px:0)+"px";

  /* 물림 상한 눈금 — 비나사부뿐 아니라 볼트 길이만으로도 상한이 생긴다.
     슬라이더가 왜 거기서 멈추는지 두 경우 모두 보이게 한다. */
  const cap=leCap(), capShown=isFinite(cap)&&cap<max-0.01;
  $("tickCap").hidden=!capShown;
  if(capShown)$("tickCap").style.left=at(cap)+"px";

  const pMin=at(R.LeMin), pOk=at(R.LeOk);
  $("tickMin").style.left=pMin+"px";
  $("tickOk").style.left=pOk+"px";
  /* 라벨은 양 끝에서 잘리지 않도록 클램프 */
  const clamp=(x,pad)=>Math.max(pad,Math.min(w-pad,x));
  $("lblMin").style.left=clamp(pMin,20)+"px";
  $("lblOk").style.left=clamp(pOk,32)+"px";
  /* 두 라벨이 겹치면 '최소'를 숨긴다 */
  $("lblMin").classList.toggle("hide",Math.abs(pOk-pMin)<58);
  /* Le만으로는 적합해질 수 없으면 기준선을 흐리고 문구를 바꾼다.
     기준선이 트랙 밖으로 나간 경우(수지 모재)에는 잘린 위치가 기준인 것처럼 보이면 안 되므로
     실제 값을 라벨에 적고 눈금을 흐린다. */
  const okOff=R.LeOk>max+0.01;
  $("lblOk").textContent=okOff?"적합 "+f1(R.LeOk)+"mm ▶":R.okPossible?"적합 기준":"Le 기준";
  $("lblOk").classList.toggle("blocked",!R.okPossible||okOff);
  $("tickOk").classList.toggle("blocked",!R.okPossible||okOff);

  t.setAttribute("aria-valuenow",R.hasLe?f1(R.Le):0);
  t.setAttribute("aria-valuemax",f1(max));
  t.setAttribute("aria-valuetext",R.hasLe
    ?f1(R.Le)+"mm, "+R.threads.toFixed(1)+"산, 판정 "+R.tag
    :"미설정, "+(R.reachCapped?"볼트 길이 한도 "+f1(R.LeShow):"적합 기준 "+f1(R.LeOk))+"mm 가정");
}
(function slider(){
  const t=$("track"); let drag=false,pid=null;
  const frac=x=>{const r=t.getBoundingClientRect();
    return Math.max(0,Math.min(1,(x-r.left)/r.width));};
  const set=(x,haptic)=>{
    const wasOk=R&&R.lvl==="ok";
    setLe(Math.max(.1,Math.round(frac(x)*leMax()*10)/10));
    render(true);
    const nowOk=R&&R.lvl==="ok";
    /* 판정이 넘어가는 순간에만 진동·"탁!" — 같은 판정이 이어지는 프레임은 조용히 */
    if(haptic&&nowOk!==wasOk){
      const th=$("thumb"); th.classList.add("pulse");
      setTimeout(()=>th.classList.remove("pulse"),260);
      if(navigator.vibrate)try{navigator.vibrate(nowOk?[10,40,16]:12)}catch(e){}
      if(nowOk){                       // 적합 진입 순간에만 "탁!"
        const sn=$("snap"); sn.style.left=th.style.left;
        sn.classList.remove("go"); void sn.offsetWidth; sn.classList.add("go");
      }
    }
  };
  let raf=null,px=null;
  t.addEventListener("pointerdown",e=>{
    drag=true; pid=e.pointerId;
    set(e.clientX,false); try{t.setPointerCapture(e.pointerId)}catch(_){} e.preventDefault();
  });
  window.addEventListener("pointermove",e=>{
    if(!drag||(pid!==null&&e.pointerId!==pid))return;
    px=e.clientX;
    if(raf)return;                       // 프레임당 1회로 제한
    raf=requestAnimationFrame(()=>{raf=null;if(drag)set(px,true);});
  },{passive:true});
  const end=()=>{
    if(!drag)return; drag=false;
    if(raf){cancelAnimationFrame(raf);raf=null;}
    try{if(pid!==null)t.releasePointerCapture(pid)}catch(_){} pid=null;
    render();                            // 드래그 종료 시 전체 갱신
  };
  window.addEventListener("pointerup",end); window.addEventListener("pointercancel",end);
  t.addEventListener("keydown",e=>{
    const st=P&&!P.err?Math.max(.1,Math.round(P.d)/10):.5;
    const go=v=>{setLe(v);render();e.preventDefault();};
    if(e.key==="ArrowRight"||e.key==="ArrowUp")go(Math.round((S.Le+st)*10)/10);
    else if(e.key==="ArrowLeft"||e.key==="ArrowDown")go(Math.max(0,Math.round((S.Le-st)*10)/10));
    /* 물릴 수 있는 끝까지 — 길이 미지정이면 상한이 없으니 트랙 끝으로 */
    else if(e.key==="End"){const c=leCap(); go(isFinite(c)?c:leMax());}
    else if(e.key==="PageUp")go(Math.round((S.Le+st*5)*10)/10);
    else if(e.key==="PageDown")go(Math.max(0,Math.round((S.Le-st*5)*10)/10));
    else if(e.key==="Home"){S.Le=0;render();e.preventDefault();}
  });
})();

/* 볼트 길이 슬라이더 (선택) — 표준 길이로 스냅하고 사양 문자열을 다시 쓴다 */
(function lenSlider(){
  const t=$("ltrack"); let drag=false,pid=null,raf=null,px=null;
  const set=x=>{
    if(!lenOn())return;
    const r=t.getBoundingClientRect();
    const f=Math.max(0,Math.min(1,(x-r.left)/r.width));
    if(setBoltLen(f*lenMax()))render();
  };
  t.addEventListener("pointerdown",e=>{
    drag=true; pid=e.pointerId; set(e.clientX);
    try{t.setPointerCapture(e.pointerId)}catch(_){} e.preventDefault();
  });
  window.addEventListener("pointermove",e=>{
    if(!drag||(pid!==null&&e.pointerId!==pid))return;
    px=e.clientX;
    if(raf)return;
    raf=requestAnimationFrame(()=>{raf=null;if(drag)set(px);});
  },{passive:true});
  const end=()=>{
    if(!drag)return; drag=false;
    if(raf){cancelAnimationFrame(raf);raf=null;}
    try{if(pid!==null)t.releasePointerCapture(pid)}catch(_){} pid=null;
  };
  window.addEventListener("pointerup",end); window.addEventListener("pointercancel",end);
  t.addEventListener("keydown",e=>{
    if(!lenOn())return;
    const ok=lenPicks();
    if(!ok.length)return;
    const step=/^(ArrowRight|ArrowUp|ArrowLeft|ArrowDown|Home|End)$/.test(e.key);
    if(!step)return;
    e.preventDefault();
    /* 길이가 아직 없으면 첫 키 입력이 길이를 세운다 — 이게 없으면 키보드만으로는
       길이를 영원히 지정할 수 없다 (포인터 전용 기능이 되어 버린다) */
    if(P.len==null){
      if(setBoltLen(Math.max(4*P.d,ok[0])))render();
      return;
    }
    /* 현재 길이가 후보에 없을 수도 있으니 후보 안에서 가장 가까운 칸을 기준으로 잡는다 */
    const i=ok.indexOf(snapIn(ok,P.len));
    const j=e.key==="Home"?0
           :e.key==="End"?ok.length-1
           :(e.key==="ArrowRight"||e.key==="ArrowUp")?Math.min(ok.length-1,i+1)
           :Math.max(0,i-1);
    if(setBoltLen(ok[j]))render();
  });
})();
$("leReset").onclick=()=>{S.Le=0;render();};
$("leFit").onclick=()=>{const v=leFit(); if(v!=null){setLe(v);render();}};

/* ══════════════════════════════════════════════════════════
   계산 근거

   근거 출처 — 계산 단계마다 어디서 나온 값인지 함께 표기한다.
   공식만 남기면 규격에서 온 값과 자체 경험값이 구분되지 않는다.
   t : 1 공식 표준규격 / 2 볼트 체결 설계 표준 / 3 전문 자료·제조사 TDS / 4 자체 경험값
   ══════════════════════════════════════════════════════════ */
const SRC={
  iso898 :{t:1,label:"ISO 898-1",       note:"강도구분 기계적 성질 · 유효단면적 정의"},
  iso3506:{t:1,label:"ISO 3506-1",      note:"스테인리스 볼트 기계적 성질"},
  iso261 :{t:1,label:"ISO 261 / 68-1",  note:"기본 산형 · 피치 · 유효경/골지름"},
  iso4762:{t:1,label:"ISO 4762",        note:"육각홀붙이 머리 지름"},
  iso4032:{t:1,label:"ISO 4032",        note:"표준 너트 높이 — TDS 시험의 기준 물림"},
  jis    :{t:1,label:"JIS · KS 재료규격", note:"모재 인장강도 (G4051 · G3101 · G5501 등)"},
  vdi    :{t:2,label:"VDI 2230",        note:"볼트 체결 설계 지침 · 표 A5 마찰계수 등급"},
  nutf   :{t:3,label:"nut-factor 관행",  note:"등가 K 환산 표기 — T=K·F·d 자체는 규격 아님"},
  roet   :{t:3,label:"Rötscher 원추",    note:"부재 강성 30° 압축 원추 모델 (Shigley) — VDI의 대체 원통식과 다름"},
  iso10642:{t:1,label:"ISO 10642",      note:"접시머리 높이 · 머리 내력 80% (NOTE 2) — 8.8·10.9·12.9 모두 포함"},
  tds    :{t:3,label:"Henkel TDS",      note:"LOCTITE 제품 데이터시트 (ISO 10964 시험)"},
  mfr    :{t:3,label:"제조사 공표값",    note:"Unbrako 420/800 MPa · Bossard 감액 토크표 · Hobson 체결 토크표"},
  own    :{t:4,label:"자체 경험값",      note:"규격 근거 없음 — 실물 시험으로 재교정 필요"}
};
const SRC_TIER=[
  {t:1,star:"★★★★★", name:"공식 표준규격",         ex:"ISO · DIN · JIS · KS"},
  {t:2,star:"★★★★★", name:"볼트 체결 설계 표준",    ex:"VDI 2230"},
  {t:3,star:"★★★★☆", name:"전문 자료 · 제조사 TDS", ex:"Bossard · Bolt Science · Henkel"},
  {t:4,star:"검증 필요",name:"자체 경험 보정값",      ex:"실물 파단 시험으로 재교정해야 함"}
];
/* 배지에 title만 달면 터치 기기에서는 근거 설명을 볼 방법이 없다.
   설명은 아래 "출처 목록"에 항상 펼쳐 두고, 배지에는 aria-label로도 붙인다. */
const srcTag=(...keys)=>`<span class="srcs">`+keys.map(k=>{
  const s=SRC[k];
  const full=s.label+" — "+s.note;
  return `<i class="src t${s.t}" title="${esc(full)}" aria-label="${esc("근거: "+full)}">${esc(s.label)}</i>`;
}).join("")+`</span>`;

function writeBasis(){
  if(!R)return;
  /* 비나사부 단계가 조건부로 끼어들므로 번호를 고정하지 않고 순서대로 매긴다 */
  const b=[]; let _n=0; const sn=()=>++_n;
  b.push(`<span class="st">${sn()} · 볼트 유효단면적</span>As = π/4 × (${R.d} − 0.938194 × ${R.p})² = <b>${f2(R.As)} mm²</b>`
    +`<br><span class="mut">0.938194는 유효경 d₂와 골지름 d₃의 평균 계수 — 나사 기본 산형에서 유도됩니다</span>`
    +srcTag("iso898","iso261"));
  b.push(`<span class="st">${sn()} · 강도구분 ${R.cls}</span>σy ${R.C.sy} MPa · σu ${R.C.su} MPa`
    +(R.C.big?`<br><span class="mut">ISO 898-1은 8.8을 호칭경으로 나눕니다 — d>16이라 830/660 MPa를 적용했습니다 (d≤16은 800/640).</span>`:``)
    +(R.H.rl
      ? `<br>머리 내력 = 나사부의 <b>${(R.H.fu*100).toFixed(0)}%</b> → 파단 하중 ${f0(R.FuHead)} N`
        +`<br><span class="mut">ISO 10642 NOTE 2 — "The loadability in the head is assumed to be 80% of `
        +`that in the thread for all sizes and all property classes". 전 등급 공통이며 <b>등급 상한이 아닙니다</b>. `
        +`ISO 10642 · ISO 14581 · JIS B 1194 모두 12.9를 포함하므로 선택한 등급을 낮추지 않습니다.</span>`
      : ``)
    +srcTag(/^A2/.test(R.cls)?"iso3506":"iso898",...(R.H.rl?["iso10642"]:[])));
  let s3=`<span class="st">${sn()} · 축력</span>목표 = ${S.preload}% × ${f2(R.As)} × ${R.C.sy} = ${f0(R.Fwant)} N`;
  if(R.H.fp<1) s3+=`<br>머리 형상 조임 계수 ×${R.H.fp.toFixed(2)} → <b>${f0(R.Fhead)} N</b>`
    +`<span class="mut"> — ${R.H.rl
        ? `육각홀이 먼저 한계라 조일 수 있는 축력이 줄어듭니다. 제조사 공표값 기준 `
          +`(Unbrako 목표 응력 420 / 표준 800 MPa = 0.53 · Bossard 감액 토크 ≈0.45 · Hobson ≈0.63)`
        : `자체 경험값 — 규격 근거 없음`}</span>`;
  if(R.limited) s3+=`<br><span class="bad">뽑힘 안전율 ${STRIP_SF.toFixed(1)} 확보를 위해 <b>${f0(R.Feff)} N</b>으로 하향 제한</span>`;
  else s3+=`<br>적용 축력 <b>${f0(R.Feff)} N</b>`;
  s3+=`<br><span class="mut">마찰 산포 ±${K_SCAT*100}% → 실제 ${f0(R.Flo)} ~ ${f0(R.Fhi)} N. `
     +`이 폭은 VDI 2230의 조임계수 αA ≈ 1.8에 해당합니다.<br>`
     +`<b>목표 축력 ${S.preload}%는 순수 인장 기준</b>입니다. 비틀림을 더한 실제 항복 이용률은 `
     +`아래 조합응력 단계에서 <b>${(R.util*100).toFixed(0)}%</b>로 나옵니다 — VDI가 말하는 "이용률 90%"와 `
     +`같은 뜻이 아닙니다.<br>`
     +`목표 축력 비율과 뽑힘 안전율 ${STRIP_SF.toFixed(1)}은 규격이 아니라 자체 설정값입니다.`
     +(R.H.rl?` 머리 조임 계수는 제조사 공표값, 머리 내력 ${(R.H.fu*100).toFixed(0)}%는 규격값입니다.`
             :R.H.fp<1?` 머리 형상 계수도 자체 설정값입니다.`:``)+`</span>`
     +srcTag("vdi",R.H.rl?"mfr":"own");
  b.push(s3);
  /* 마찰은 VDI 2230 세 항으로 푼다. 예전에는 K 하나만 보여줬는데, K 숫자와 μ 숫자가
     다르다는 사실이 그 뒤에 가려져 있었다 — 화면에 μ를 직접 띄우는 것이 이 단계의 요점이다. */
  const d2=R.d-0.6495*R.p, DKm=(R.dLoad+HOLE_R*R.d)/2;
  b.push(`<span class="st">${sn()} · 체결토크</span>`
    +`M = F × [0.16·P + 0.58·d₂·μ<sub>G</sub> + (D<sub>Km</sub>/2)·μ<sub>K</sub>]<br>`
    +`= ${f0(R.Feff)} × [0.16×${R.p} + 0.58×${f2(d2)}×${R.mu} + (${f1(DKm)}/2)×${R.mu}]`
    +` = <b>${sig3(R.Trec)} N·m</b><br>`
    +`<span class="mut">마찰계수 <b>μ ${R.mu}</b> — VDI 2230 표 A5 <b>${R.kf.cls}등급</b> `
    +`(${R.kf.band[0]}~${R.kf.band[1]}) · ${esc(R.kf.label)}<br>`
    +`d₂ 유효경 ${f2(d2)} mm · D_Km 좌면 유효 마찰경 ${f1(DKm)} mm`
    +`(좌면 ${f1(R.dLoad)}${R.H.cone?" — 접시는 ISO 10642 이론 머리 지름 2.24d":""} + 구멍 ${f1(HOLE_R*R.d)})</span>`
    +`<br>등가 K = M/(F·d) = <b>${R.K.toFixed(3)}</b> `
    +`<span class="mut">— 관행식 T = K·F·d로 환산한 값입니다. `
    +`<b>K와 μ는 같은 숫자가 아닙니다</b>: 피치 성분 0.16P가 K 안에 이미 들어 있어 `
    +`K 0.20은 μ 0.145에 해당합니다.</span>`
    +`<br><span class="${R.kf.cls==="C"||R.kf.cls==="D"?"wr":"mut"}">`
    +`이 등급 폭(μ ${R.kf.band[0]}~${R.kf.band[1]})만으로도 토크는 `
    +`<b>${sig3(R.Klo*R.Feff*R.d/1000)} ~ ${sig3(R.Khi*R.Feff*R.d/1000)} N·m</b> 범위입니다 — `
    +`표면 상태를 잘못 고르면 이만큼 어긋납니다.</span>`
    +srcTag("vdi","nutf"));
  b.push(`<span class="st">${sn()} · 체결 중 조합응력</span>인장 σ = ${R.sigma.toFixed(0)} MPa · 비틀림 τ = ${R.tau.toFixed(0)} MPa<br>`
    +`σeq = √(σ² + 3(0.5τ)²) = <b>${R.sigEq.toFixed(0)} MPa</b> = 항복의 `
    +`<span class="${R.util>1?"bad":R.util>0.92?"wr":"good"}">${(R.util*100).toFixed(0)}%</span>`
    +`<br><span class="mut">등가응력식과 비틀림 감소계수 ${K_TAU}는 VDI 2230. `
    +`나사부 토크 비율 ${TG_FRAC}도 같은 식에서 유도됩니다 (M5 0.50 · M12 0.51).<br>`
    +`단, 단면계수는 골지름 d₃ 기준이라 VDI의 응력지름 기준보다 τ가 약 15~20% 크게 — 보수적으로 나옵니다.</span>`
    +srcTag("vdi","iso261"));
  if(R.hasLe){
    b.push(`<span class="st">${sn()} · 나사산 뽑힘</span>모재 ${R.M.label} · τu = 0.6 × ${R.M.su} = ${Math.round(tauOf(S.mat))} MPa<br>`
      +`Ats = 0.875 × π × ${R.d} × ${f1(R.Le)} × ${KNOCK} = ${f2(R.Ats)} mm²<br>`
      +`탭 내력 <b>${f0(R.Fstrip)} N</b> / 축력 ${f0(R.Fhead)} N = 여유 `
      +`<span class="${R.margin<STRIP_SF?"bad":"good"}">${f2(R.margin)}배</span>`
      +`<br><span class="mut">0.875는 60° 나사 기하에서 유도된 값(0.5 + 0.57735 × 0.649519 = 0.5 + 0.375)이고, `
      +`<b>${KNOCK}만 자체 경험 보정</b>입니다 (문헌 0.6~0.85). τu = 0.6σu도 규격이 아닌 공학 통칙입니다.</span>`
      +srcTag("iso261","jis","own"));
  }else if(R.LeAssume!=null){
    /* Le 미설정이어도 "탭 충분"을 무조건 가정하지는 않는다 — 볼트가 내줄 수 있는
       물림이 기준에 못 미치면 그 한도로 축력을 묶고, 그 사실을 여기에 남긴다 */
    b.push(`<span class="st">${sn()} · 나사산 뽑힘</span>`
      +`<span class="wr">Le 미설정</span> — 볼트 길이로 도달 가능한 최대 물림 `
      +`<b>${f1(R.LeReach)} mm</b>${R.ls>0?` (비나사 ${f1(R.ls)} + 불완전 나사 2p 제외)`:``}<br>`
      +`가정 물림 = min(적합 기준 ${f1(R.LeOk)}, 도달 가능 ${f1(R.LeReach)}) = <b>${f1(R.LeAssume)} mm</b>`
      +(R.reachLimited
        ? `<br><span class="bad">이 물림으로는 뽑힘 안전율 ${STRIP_SF.toFixed(1)}을 못 지키므로 축력을 `
          +`<b>${f0(R.Feff)} N</b>으로 하향 제한했습니다 — 볼트 길이가 토크를 결정한 경우입니다.</span>`
        : `<br>이 물림이면 뽑힘 안전율 ${STRIP_SF.toFixed(1)}을 만족하므로 축력을 깎지 않았습니다.`)
      +`<br><span class="mut">판재 두께 0을 가정한 최선의 경우입니다. 실제 물림을 넣으면 이 가정이 사라집니다.</span>`
      +srcTag("iso261","own"));
  }else{
    b.push(`<span class="st">${sn()} · 나사산 뽑힘</span><span class="wr">Le·볼트 길이 미설정으로 미실시 — 탭 충분 가정.</span>`);
  }
  if(R.Db){
    const pgStd=PG_VDI.has(S.mat);
    b.push(`<span class="st">${sn()} · 좌면 면압</span>좌면 지름 ${f1(R.Db)} mm${R.washerOn?" (와셔 기준)":""}<br>`
      +`p = ${f0(R.Fhi)} N ÷ 면적 = <b>${Math.round(R.pBear)} MPa</b> / 한계 ${R.M.pG} MPa `
      +`<span class="${R.pRatio>1?"bad":R.pRatio>0.85?"wr":"good"}">(${(R.pRatio*100).toFixed(0)}%)</span>`
      +`<br><span class="mut">축력 상한값으로 보수 검토. 좌면 지름은 ${R.washerOn?"와셔 규격":"ISO 4762 머리 치수"} 기준.<br>`
      +(pgStd
        ? `한계 면압 ${R.M.pG} MPa는 VDI 2230 수록 재질(${R.M.label})과 대응합니다.`
        : `<span class="wr">한계 면압 ${R.M.pG} MPa는 VDI 2230 수록 재질과 직접 대응하지 않는 외삽값입니다 — 원표 대조 필요.</span>`)
      +`</span>`
      +srcTag("vdi",pgStd?"iso4762":"own"));
  }else{
    b.push(`<span class="st">${sn()} · 좌면 면압</span><span class="wr">${R.H.cone?"접시머리 원추 좌면 — 미검토":"좌면 형상 미정"}</span>`
      +(R.H.cone&&R.dLoad
        ? `<br><span class="mut">원추 좌면은 면압 분포를 이 모델로 다룰 수 없어 판정하지 않습니다. `
          +`단, 부재 강성(δP)에는 하중이 판재로 퍼지기 시작하는 원이 필요하므로 `
          +`ISO 10642 이론 머리 지름 <b>${f1(R.dLoad)} mm (2.24d)</b>를 씁니다 — 면압 미검토와 별개의 가정입니다.</span>`
          +srcTag("iso10642","own")
        : ``));
  }
  /* 비나사부를 입력했을 때만 — 그립 기하와 탄성 계산의 근거 */
  if(R.ls>0){
    let s=`<span class="st">${sn()} · 비나사부 · 체결 두께</span>`;
    if(R.Lu==null||!R.hasLe||!R.shankOn){
      s+=`<span class="wr">${R.Lu==null?"볼트 길이 미지정":!R.hasLe?"Le 미설정":"샹크가 들어갈 구간 0 이하"} — 검토 불가</span>`;
    }else{
      s+=`체결 두께 Lk = ${R.len} − Le ${f1(R.Le)} = <b>${f1(R.Lk)} mm</b>`
        +(R.H.cone
          ? `<br><span class="mut">접시는 머리가 판재에 잠기므로 카운터싱크 ${f1(R.headH)} mm도 판재 두께의 일부입니다 — `
            +`호칭 길이에서 머리를 빼지 않습니다.</span>`
          : ``)
        +`<br>그중 볼트 원통부가 지나는 구간 = <b>${f1(R.Lbore)} mm</b>`
        +(R.H.cone?` <span class="mut">(Lk − 카운터싱크 ${f1(R.headH)})</span>`:` <span class="mut">(= Lk)</span>`)+`<br>`
        +`비나사부 ${f1(R.ls)} + 불완전 나사 2p ${f1(2*R.p)} = ${f1(R.ls+2*R.p)} mm `
        +`<span class="${R.ls+2*R.p>R.Lbore?"bad":"good"}">(여유 ${f1(R.Lbore-R.ls-2*R.p)} mm)</span>`;
      if(R.dS){
        s+=`<br>볼트 컴플라이언스 δS = <b>${(R.dS*1e6).toFixed(2)}</b> ×10⁻⁶ mm/N `
          +`<span class="mut">(머리 + 비나사부 ${f1(Math.min(R.ls,R.Lbore))} + 미물림 나사 ${f1(R.lg)} + 물림부)</span>`;
      }
      if(R.dP){
        s+=`<br>부재 컴플라이언스 δP = <b>${(R.dP*1e6).toFixed(2)}</b> ×10⁻⁶ mm/N `
          +`<span class="mut">(하중 도입 지름 ${f1(R.dLoad)} mm)</span> · `
          +`하중계수 Φ = δP/(δS+δP) = <b>${(R.phi*100).toFixed(0)}%</b><br>`
          +`이완 손실 F_Z = f_Z ${(FZ_UM+(R.washerOn?FZ_UM_W:0)).toFixed(1)} µm ÷ (δS+δP) = `
          +`<b>${f0(R.Fz)} N</b> = 축력의 ${(R.embedCalc*100).toFixed(1)}% `
          +(R.embedCapped
            ? `<span class="wr">(모델 상한 50%에 걸렸습니다 — 이 형상은 탄성 이완 모델의 적용 범위 밖입니다)</span>`
            : `<span class="mut">(고정값 ${(EMBED*100).toFixed(0)}% 대비)</span>`)
          +`<br><span class="mut">각도법 참고 — 밀착 후 필요 회전각 약 <b>${R.turnDeg.toFixed(0)}°</b> `
          +`(볼트 신장 + 부재 압축 + 샹크 비틀림). 토크법에는 쓰이지 않는 참고값입니다.</span>`;
      }
      s+=`<br><span class="mut">해석 수준 <b>${SLV_SEG.find(o=>o.v===R.slv).label}</b> — `
        +(R.useEmbed?`이완 손실에 반영 중`:`기하 검사만 반영, 이완은 ${(EMBED*100).toFixed(0)}% 고정 유지`)
        +(R.usePhi?` · 하중계수도 반영 중`:``)+`.<br>`
        +`δS는 VDI 2230의 구간 분해를, δP는 Rötscher 30° 압축 원추(Shigley)를 씁니다 — `
        +`VDI의 대체 원통식은 접합면 외경 D_A에 따라 분기하므로 채택하지 않았습니다. `
        +(R.H.cone
          ? `접시머리는 좌면 면압을 판정하지 않지만 δP에는 하중 도입 원이 필요해 `
            +`<b>ISO 10642 이론 머리 지름 2.24d</b>를 썼습니다 — 원추 접촉을 평좌면으로 치환한 가정입니다. `
          : ``)
        +`f_Z ${FZ_UM} µm은 원표 대조가 필요한 가정값입니다.</span>`
        +srcTag("vdi","roet",R.H.cone?"iso10642":"iso4762","own");
    }
    b.push(s);
  }
  if(R.Freq!==null){
    const need=S.loadType==="axial"
      ? (R.usePhi ? `필요 축력 = ${SF_SEP} × (1 − Φ ${(R.phi*100).toFixed(0)}%) × ${f0(S.load)} N`
                  : `필요 축력 = ${SF_AXIAL} × ${f0(S.load)} N`)
      : `필요 축력 = ${SF_SHEAR} × ${f0(S.load)} ÷ μ ${MU_JOINT}`;
    b.push(`<span class="st">${sn()} · 작용 하중 대비</span>`
      +`<span class="mut">볼트 <b>1개</b>·접합면 <b>1개</b>가 받는 하중 기준입니다. 조인트 전체 하중을 넣으면 `
      +`볼트 개수만큼 결과가 틀립니다 — 나눠서 넣으세요.</span><br>${need} = <b>${f0(R.Freq)} N</b><br>`
      +`이완 후 잔존 축력 = ${f0(R.Feff)} × (1 − ${(R.embedUse*100).toFixed(1)}%) = ${f0(R.Fserv)} N `
      +`<span class="${R.Fserv<R.Freq?"bad":"good"}">(${f2(R.Fserv/R.Freq)}배)</span>`
      /* F_SA·sigMax는 축방향 하중에서만 구한다 — 횡하중은 외력이 축방향이 아니라 Φ와 무관하다.
         usePhi만 보고 열면 전단 + 해석수준 "하중 계수" 조합에서 null.toFixed로 죽는다.
         검토 항목 쪽은 이미 sigMax!=null로 막고 있었어서 여기만 어긋나 있었다. */
      +(R.usePhi&&R.sigMax!=null?`<br>외력 중 볼트 분담 F_SA = Φ × ${f0(S.load)} = <b>${f0(R.Fsa)} N</b> → `
        +`최대 응력 ${R.sigMax.toFixed(0)} MPa = 항복의 ${(R.sigMax/R.C.sy*100).toFixed(0)}%`:``)
      +`<br><span class="mut">`
      +(R.useEmbed?`이완 손실은 비나사부 기반 탄성 계산값입니다. `
                  :`이완 손실 ${EMBED*100}%는 자체 설정값입니다 (VDI 2230은 표면거칠기·강성으로 산출). `)
      +(R.usePhi?`분리 안전율 ${SF_SEP}은 자체 설정값이고, 하중 도입계수 n = 1로 보수 처리했습니다.`
                :`안전율 ${SF_AXIAL}·${SF_SHEAR}는 자체 설정값입니다.`)
      +(S.loadType==="shear"?` 접합면 마찰 μ ${MU_JOINT}는 VDI 2230의 건조 강재 범위(0.10~0.15) <b>상한</b>이라 낙관적인 쪽입니다.`:"")
      +`</span>`
      +srcTag("own","vdi"));
  }
  b.push(`<span class="st">${sn()} · 필요 최소 물림</span>Le,min = <b>${f1(R.LeMin)} mm</b> = ${f2(R.LeMin/R.d)}d`
    +(R.LeReach!=null
      ? `<br>볼트 길이로 도달 가능한 최대 물림 = <b>${f1(R.LeReach)} mm</b> `
        +`<span class="${R.LeReach<R.LeMin?"bad":R.LeReach<R.LeOk?"wr":"good"}">`
        +(R.LeReach<R.LeMin?`(최소에 미달 — 볼트가 짧습니다)`
         :R.LeReach<R.LeOk?`(적합 기준 ${f1(R.LeOk)} mm에 미달)`
         :`(적합 기준 ${f1(R.LeOk)} mm까지 여유 있음)`)+`</span>`
      : ``)
    +`<br><span class="mut">뽑힘 모델을 "볼트가 먼저 파단"하는 조건으로 역산한 값이라 근거 등급도 뽑힘 항목과 같습니다. `
    +(R.H.fu<1?`볼트 파단 하중에 머리 내력 계수 ${R.H.fu.toFixed(2)}를 적용했으므로 예상 파단 토크와 기준이 일치합니다.`
             :`볼트 파단 하중은 Fu 그대로입니다.`)+`</span>`
    +srcTag("iso261","own"));

  const legend=SRC_TIER.map(x=>
    `<div class="lg-row"><i class="src t${x.t}">${x.star}</i>`
    +`<span><b>${esc(x.name)}</b> <span class="mut">${esc(x.ex)}</span></span></div>`).join("");
  /* 출처 목록 — 배지 title은 터치에서 안 열리므로 설명을 항상 보이게 둔다 */
  const gloss=Object.keys(SRC)
    .sort((a,b)=>SRC[a].t-SRC[b].t)
    .map(k=>`<div class="lg-row"><i class="src t${SRC[k].t}">${esc(SRC[k].label)}</i>`
      +`<span class="mut">${esc(SRC[k].note)}</span></div>`).join("");
  $("basis").innerHTML=b.join("<hr>")
    +`<hr><div class="src-legend"><span class="st">근거 등급</span>${legend}`
    +`<div class="src-gloss"><span class="st">출처 목록</span>${gloss}</div>`
    +`<p class="lg-note">치수·재료 물성은 공식 규격에서, 응력·면압 판정은 VDI 2230에서 옵니다. `
    +`반면 <b>대표식 T = K·F·d는 업계 관행</b>이고, 판정을 실제로 좌우하는 보정계수 `
    +`${KNOCK}·머리 형상 계수·안전율 ${STRIP_SF.toFixed(1)}은 규격 근거가 없는 자체값입니다. `
    +`설계 승인 문서에 인용할 때는 이 구분을 그대로 옮겨 주세요.</p></div>`;
}

/* ══════════════════════════════════════════════════════════
   실측 대조 — 행별 재질 고정. 미상은 범위로 표기하고 편차 계산 안 함
   ══════════════════════════════════════════════════════════ */
function fillMeas(){
  if(!R)return;
  /* 시트에는 파단까지 간 행과 권장 토크만 산정한 행이 섞여 있다.
     파단 대조 표에는 앞의 것만 올리고, 뒤의 것도 권장 토크 비교에는 쓴다. */
  const same=MEAS.filter(m=>m.d===R.d);
  const rows=same.filter(m=>m.T!=null), tb=$("measBody");
  $("measCnt").textContent=same.length?rows.length+" / "+same.length+"건":"—";
  tb.innerHTML="";
  if(!rows.length){
    tb.innerHTML=`<tr><td colspan="5" class="mut" style="text-align:center;padding:18px">`
      +(same.length?`M${R.d} 시험 ${same.length}건 — 파단까지 간 행은 없습니다`
                   :`M${R.d} 시험 데이터 없음`)+`</td></tr>`;
    $("measSumm").textContent=""; $("measWarn").innerHTML=ownCompare(same); return;
  }
  const devs=[]; let unknown=0, assumed=0; const html=[];
  MEAS.forEach((m,i)=>{
    if(m.d!==R.d||m.T==null)return;
    const q=MEAS_PRED[i];
    if(q.gaps.length)assumed++;
    /* 기록이 없어 가정으로 채운 항목을 행마다 그대로 적는다 — 재질만 경고하고
       강도구분·체결조건을 조용히 12.9·K0.20으로 두면 편차를 잘못 읽게 된다 */
    const head=`<td>${m.use}<br><span class="mut" style="font-size:11px">${HEAD[m.head].label} · `
      +(m.mat||(q.boltGov?"재질 미상 — 볼트 지배라 무관":"재질 미상"))
      +(q.gaps.length?`<br>가정: ${q.gaps.join(" · ")}`:"")+`</span></td>`
      +`<td class="mut">${f1(m.Le)}</td><td><b>${m.T.toFixed(2)}</b></td>`;
    if(q.known){
      devs.push(q.dev);
      const cl=Math.abs(q.dev)<20?"d-ok":Math.abs(q.dev)<40?"d-mid":"d-bad";
      html.push(`<tr>${head}<td class="mut">${sig3(q.T)}</td><td class="${cl}">${q.dev>0?"+":""}${q.dev.toFixed(0)}%</td></tr>`);
    }else{
      unknown++;
      html.push(`<tr>${head}<td class="mut">${sig3(q.lo)}~${sig3(q.hi)}</td><td class="mut">산출 불가</td></tr>`);
    }
  });
  tb.innerHTML=html.join("");
  if(devs.length){
    const avg=devs.reduce((a,b)=>a+b,0)/devs.length;
    /* 부호를 보여주는 게 크기보다 중요하다 — 예상이 실측보다 낮으면 모델이 보수적이라
       안전 쪽이고, 높으면 파단을 낙관하고 있다는 뜻이라 성격이 다르다. */
    $("measSumm").innerHTML=`대조 가능한 ${devs.length}건 평균 편차 <b>${avg>0?"+":""}${avg.toFixed(0)}%</b> `
      +`<span class="mut">(${avg<0?"예상이 실측보다 낮음 — 보수적":"예상이 실측보다 높음 — 파단을 낙관"})</span>. `
      +`실측은 ${MEAS_N}회 평균입니다. 예상 파단은 원리적으로 정밀도가 낮으므로 ±20~40%는 정상 범위입니다.`;
  }else $("measSumm").textContent="";
  const notes=[];
  if(unknown)
    notes.push(`<b>${unknown}건은 행별 모재가 기록되어 있지 않습니다.</b> 예상값을 S45C~SS400 범위로만 표시하고 편차는 계산하지 않았습니다. `
      +`알루미늄이면 값이 절반 이하로 내려가 결론이 완전히 뒤집힙니다.`);
  if(assumed)
    notes.push(`<b>${assumed}건은 재질 외에도 강도구분·체결 조건이 기록되지 않아 `
      +`${MEAS_ASSUME.cls} · 마찰 ${KF[MEAS_ASSUME.k].label}(μ ${KF[MEAS_ASSUME.k].mu})로 가정했습니다.</b> `
      +`강도구분 가정은 볼트 지배 구간에서 파단 하중을 최대 1.5배까지, 체결 조건은 K를 통해 토크를 직접 흔듭니다. `
      +`행마다 무엇을 가정했는지는 위 표에 적었습니다.`);
  if(notes.length)
    notes.push(`<b>행별 재질·강도구분·체결 조건, 그리고 파괴 모드 기록이 이 시험의 가장 시급한 보완 사항입니다.</b>`);
  $("measWarn").innerHTML=ownCompare(same)+notes.join(" ");
}

/* 사내 권장 체결 토크와 앱 권장 토크를 나란히 둔다.
   파단 대조는 "모델이 파괴를 맞히나"를 보지만, 실제로 현장이 쓰는 숫자와 맞는지는
   이쪽이 답한다 — 마찰계수를 바꾼 뒤 이 줄이 검증 화면 역할을 한다. */
function ownCompare(same){
  if(!R)return "";
  /* 머리 형상이 다르면 권장 토크가 절반까지 갈리므로 같은 머리끼리만 비교한다.
     호칭경만 맞춰 묶으면 접시와 표준이 섞여 범위가 무의미해진다. */
  const rows=same.filter(m=>m.own!=null&&m.head===S.head);
  if(!rows.length){
    const other=same.filter(m=>m.own!=null);
    return other.length
      ? `<p style="margin:0 0 10px" class="mut">M${R.d} 사내 시험은 ${[...new Set(other.map(m=>HEAD[m.head].label))].join("·")}만 있어 `
        +`현재 머리 형상(${HEAD[S.head].label})과 직접 비교할 수 없습니다.</p>`
      : "";
  }
  const o=rows.map(m=>m.own);
  const lo=Math.min.apply(null,o), hi=Math.max.apply(null,o);
  const mid=o.slice().sort((a,b)=>a-b)[Math.floor(o.length/2)];
  const gap=(R.Trec/mid-1)*100, near=Math.abs(gap)<=15;
  return `<p style="margin:0 0 10px"><b>사내 권장 체결 토크</b> — M${R.d} ${HEAD[S.head].label} ${o.length}건 `
    +(lo===hi?`<b>${sig3(lo)} N·m</b>`:`<b>${sig3(lo)} ~ ${sig3(hi)} N·m</b> (중앙 ${sig3(mid)})`)
    +` · 현재 설정의 앱 권장 <b>${sig3(R.Trec)} N·m</b> `
    +`<span class="${near?"good":"wr"}">(${gap>0?"+":""}${gap.toFixed(0)}%)</span>`
    +(R.limited?` <span class="wr">— 앱은 뽑힘 여유를 지키려 토크를 하향 제한한 상태입니다</span>`:``)+`. `
    +`<span class="mut">사내 값은 시트 산정값의 90%이고 강도구분·모재가 적혀 있지 않습니다 — `
    +`앱 설정(${R.cls} · ${MAT[S.mat].label} · ${KF[S.k].label})과 조건이 다르면 그만큼 벌어집니다.</span></p>`;
}

/* ══════════════════════════════════════════════════════════
   바텀시트
   ══════════════════════════════════════════════════════════ */
let sheetMode=null, sheetPrev=null;
function openSheet(mode){
  sheetMode=mode;
  sheetPrev=document.activeElement;             // 닫을 때 돌려줄 포커스
  const body=$("sheetBody");
  body.innerHTML="";
  $("sheetTitle").textContent={mat:"탭 모재",head:"머리 형상",k:"체결 조건",washer:"와셔",lock:"나사 고정제"}[mode];
  const opt=(on,t,d,cb)=>{
    const b=document.createElement("button");
    b.className="opt"+(on?" on":"");
    b.innerHTML=`<span><span class="t">${esc(t)}</span>${d?`<span class="d">${esc(d)}</span>`:""}</span>
      <svg class="tk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
    b.onclick=cb; body.appendChild(b);
  };
  const strip=t=>body.insertAdjacentHTML("beforeend",
    `<div class="warn-strip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 8v5M12 16.5v.2"/><circle cx="12" cy="12" r="9"/></svg>${t}</div>`);

  if(mode==="mat"){
    strip("알루미늄은 필요 물림 깊이가 강재의 약 2배이고 한계 면압도 낮습니다. 실제 재질로 반드시 바꾸세요.");
    Object.entries(MAT).forEach(([k,v])=>opt(S.mat===k,v.label,v.desc+" · σu "+v.su+" / 한계면압 "+v.pG+" MPa",
      ()=>{S.mat=k;closeSheet();render();}));
  }else if(mode==="head"){
    strip("접시·버튼은 머리 내력 80%가 규격값(ISO 10642), 조임 축력 52%는 제조사 공표값입니다. "
         +"저두 0.50은 사내 파단 시험 1점에 맞춘 자체값이라 근거가 가장 얇습니다. "
         +"규격은 강도구분을 제한하지 않으므로 선택한 등급을 낮추지 않습니다.");
    Object.entries(HEAD).forEach(([k,v])=>opt(S.head===k,v.full,v.note,
      ()=>{S.head=k;S.headAuto=false;closeSheet();render();}));
  }else if(mode==="k"){
    strip("마찰계수 μ는 VDI 2230 표 A5 등급값입니다. 등급 폭이 넓어 토크가 ±30%까지 갈리므로 "
         +"실제 표면 상태로 고르세요 — 방청유가 남아 있는 볼트에 건식 값을 쓰면 과체결됩니다.");
    Object.entries(KF).forEach(([k,v])=>opt(S.k===k,v.label,v.desc,()=>{S.k=k;closeSheet();render();}));
  }else if(mode==="lock"){
    strip("수치는 Henkel TDS 공칭값(M10·강재·24h·ISO 10964)입니다. 실제 제품 TDS로 반드시 대조하세요.");
    Object.entries(LOCK).forEach(([k,v])=>opt(S.lock===k,v.full,
      v.bk>0?v.desc+" · M10 이탈 "+v.bk+" N·m ("+v.src+")":v.desc,
      ()=>{S.lock=k;closeSheet();render();}));
  }else if(mode==="washer"){
    strip("연질 모재(알루미늄·SPCC·수지)에 고강도 볼트를 쓰면 와셔 없이는 좌면이 함몰됩니다.");
    Object.entries(WASHER).forEach(([k,v])=>opt(S.washer===k,v.label,v.desc,()=>{S.washer=k;closeSheet();render();}));
  }
  const sh=$("sheet");
  $("scrim").classList.add("on"); sh.classList.add("on");
  sh.removeAttribute("aria-hidden"); sh.removeAttribute("inert");
  document.body.style.overflow="hidden";
  /* 포커스를 시트 안으로 옮기지 않으면 키보드·스크린리더 사용자에게는 시트가
     열렸다는 사실도, 안의 항목도 닿지 않는다. 선택된 항목부터 잡아 준다. */
  const first=body.querySelector(".opt.on")||body.querySelector(".opt")||$("sheetX");
  try{first.focus({preventScroll:true});}catch(_){try{first.focus();}catch(__){}}
}
function closeSheet(){
  const sh=$("sheet");
  $("scrim").classList.remove("on"); sh.classList.remove("on");
  sh.setAttribute("aria-hidden","true"); sh.setAttribute("inert","");
  document.body.style.overflow=""; sheetMode=null; sh.style.transform="";
  const back=sheetPrev; sheetPrev=null;
  if(back&&back.focus)try{back.focus({preventScroll:true});}catch(_){}
}
/* 시트를 연 행으로 포커스가 돌아가야 하므로 열기 버튼 자신이 sheetPrev가 된다 */
document.querySelectorAll("[data-sheet]").forEach(b=>b.onclick=()=>openSheet(b.dataset.sheet));
$("scrim").onclick=closeSheet; $("sheetX").onclick=closeSheet;
document.addEventListener("keydown",e=>{
  if(!sheetMode)return;
  if(e.key==="Escape"){closeSheet();return;}
  /* 포커스 트랩 — 시트가 모달(aria-modal)이라고 선언했으면 실제로 갇혀야 한다 */
  if(e.key!=="Tab")return;
  const f=[...$("sheet").querySelectorAll("button")].filter(el=>el.offsetParent!==null);
  if(!f.length)return;
  const first=f[0], last=f[f.length-1], a=document.activeElement;
  if(e.shiftKey&&(a===first||!$("sheet").contains(a))){last.focus({preventScroll:true});e.preventDefault();}
  else if(!e.shiftKey&&(a===last||!$("sheet").contains(a))){first.focus({preventScroll:true});e.preventDefault();}
});

(function swipe(){
  const g=$("grab"), sh=$("sheet"); let sy=0,drag=false,dy=0;
  g.addEventListener("pointerdown",e=>{drag=true;sy=e.clientY;dy=0;sh.style.transition="none";
    try{g.setPointerCapture(e.pointerId)}catch(_){} e.preventDefault();});
  window.addEventListener("pointermove",e=>{if(!drag)return;dy=Math.max(0,e.clientY-sy);
    sh.style.transform="translateY("+dy+"px)";},{passive:true});
  const end=()=>{if(!drag)return;drag=false;sh.style.transition="";
    if(dy>90)closeSheet(); else sh.style.transform="";};
  window.addEventListener("pointerup",end); window.addEventListener("pointercancel",end);
})();

/* ══════════════════════════════════════════════════════════
   기타 인터랙션
   ══════════════════════════════════════════════════════════ */
document.querySelectorAll("[data-acc]").forEach(b=>{
  b.onclick=()=>{const a=$(b.dataset.acc);a.classList.toggle("open");
    b.setAttribute("aria-expanded",a.classList.contains("open"));};
});
let toastT=null;
function toast(msg){
  const t=$("toast"); t.textContent=msg; t.classList.add("on");
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),1900);
}
$("copyBtn").onclick=async()=>{
  if(!R)return;
  const txt=sig3(R.Trec)+" N·m";
  try{await navigator.clipboard.writeText(txt);toast(txt+" 복사됨");}
  catch(e){
    const ta=document.createElement("textarea");
    ta.value=txt; ta.style.position="fixed"; ta.style.opacity="0";
    document.body.appendChild(ta); ta.select();
    try{document.execCommand("copy");toast(txt+" 복사됨");}catch(_){toast("복사할 수 없습니다");}
    document.body.removeChild(ta);
  }
  if(navigator.vibrate)try{navigator.vibrate(8)}catch(e){}
};
$("spec").addEventListener("input",e=>{S.spec=e.target.value;S.headAuto=true;render();});
$("spec").addEventListener("focus",e=>e.target.select());
$("clearBtn").onclick=()=>{S.spec="";$("spec").value="";$("spec").focus();render();};
$("load").addEventListener("input",e=>{
  S.load=Math.max(0,parseFloat(e.target.value)||0);
  if(S.load>0&&S.loadType==="none")S.loadType="axial";
  render();
});
$("loadClr").onclick=()=>{S.loadType="none";S.load=0;$("load").value="";render();};
$("shank").addEventListener("input",e=>{
  S.shank=Math.max(0,parseFloat(e.target.value)||0);
  /* 나사부가 짧아졌으면 물림을 그 안으로 당긴다 — 없는 나사산에 물릴 수는 없다 */
  if(S.Le>0)setLe(S.Le);
  render();
});
$("shankClr").onclick=()=>{S.shank=0;$("shank").value="";render();};
$("lenTgl").onclick=()=>{
  S.lenSlider=!S.lenSlider;
  render();
  /* 숨어 있던 동안은 폭이 0이라 썸 위치를 못 잡는다 — 펼친 뒤 다시 재서 잡는다 */
  if(S.lenSlider)requestAnimationFrame(()=>updateSlider(true));
};

const bar=$("bar");
addEventListener("scroll",()=>bar.classList.toggle("stuck",scrollY>4),{passive:true});
addEventListener("resize",()=>{segsStale();updateSlider(true);buildSegs();updateQuickNav();});
/* 탭을 닫거나 백그라운드로 보낼 때는 디바운스를 기다리지 않고 바로 쓴다 */
addEventListener("pagehide",saveState);
document.addEventListener("visibilitychange",()=>{if(document.hidden)saveState();});

(function init(){
  loadState();
  /* 저장값을 화면 입력에도 되돌린다 — S만 채우면 입력칸이 빈 채로 어긋난다 */
  $("spec").value=S.spec;
  if(S.load>0) $("load").value=S.load;
  if(S.shank>0)$("shank").value=S.shank;
  render();
  /* 최초 측정은 프레임 하나 뒤에 한 번 — 스타일이 다 앉은 뒤의 폭이어야 정확하다 */
  requestAnimationFrame(()=>{segsStale();buildSegs();updateSlider(true);updateQuickNav();});
})();
