"use strict";
const PI=Math.PI;

/* ══════════════════════════════════════════════════════════
   나사 제원
   ══════════════════════════════════════════════════════════ */
const PITCH={1.6:.35,2:.4,2.5:.45,3:.5,4:.7,5:.8,6:1,8:1.25,10:1.5,12:1.75,14:2,16:2,18:2.5,20:2.5,22:2.5,24:3};
const SIZES=[3,4,5,6,8,10,12];
/* ISO 4762 육각홀붙이 머리 지름 (mm) */
const DHEAD={3:5.5,4:7,5:8.5,6:10,8:13,10:16,12:18,14:21,16:24,20:30,24:36};

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
const CLS_RANK=["4.8","8.8","A2-50","A2-70","10.9","12.9"];
const CLS_SEG=["12.9","10.9","8.8","A2-70"];

/* ══════════════════════════════════════════════════════════
   머리 형상
   f    : 토크/축력 제한계수 — 경험 근사값 (규격 실측 아님)
   cap  : 규격상 최대 강도구분
   dhr  : 좌면 지름 배수 (d 대비). null = 원추 좌면(미검토)
   ══════════════════════════════════════════════════════════ */
const HEAD={
  std :{label:"표준",   full:"표준 (육각홀붙이 ISO 4762)",   f:1.00, cap:null,   dhr:null, iso:true,  note:"제한 없음"},
  cs  :{label:"접시 CS", full:"접시 CS (ISO 10642)",         f:0.75, cap:"10.9", dhr:null, cone:true, note:"헤드 두께·소켓 깊이 제한 → 규격 최대 10.9"},
  low :{label:"저두",    full:"저두 (Low head, DIN 6912)",   f:0.60, cap:"10.9", dhr:1.50, note:"실제 파괴는 육각홀 뭉개짐"},
  btn :{label:"버튼",    full:"버튼 (ISO 7380)",             f:0.70, cap:"10.9", dhr:1.90, note:"돔 헤드 강도 제한"},
  sems:{label:"SEMS",   full:"SEMS (와셔 일체)",            f:1.00, cap:"8.8",  dhr:2.10, note:"통상 4.8~8.8 또는 A2-70급"}
};

/* ══════════════════════════════════════════════════════════
   모재
   su : 인장강도 [MPa]
   pG : 한계 면압 [MPa] — VDI 2230 계열 문헌값
   shear : 전단강도 보정 (기본 0.6·su)
   thin  : 박판 여부 (모델 적용 범위 밖 경고)
   ══════════════════════════════════════════════════════════ */
/* act: 혐기성 고정제 경화 활성도  1=활성(철계) 0.5=비활성(프라이머 필요) 0=금속 아님 */
const MAT={
  S45C  :{su:570,pG:700,act:1,  label:"S45C",    desc:"기계구조용 탄소강"},
  SCM440:{su:980,pG:900,act:1,  label:"SCM440",  desc:"크롬몰리브덴강"},
  SS400 :{su:400,pG:490,act:1,  label:"SS400",   desc:"일반 구조용 압연강"},
  SPCC  :{su:270,pG:260,act:1,  label:"SPCC",    desc:"냉간압연 강판",thin:true},
  SUS304:{su:520,pG:630,act:.5, label:"SUS304",  desc:"스테인리스"},
  A6061 :{su:310,pG:300,act:.5, label:"A6061-T6",desc:"알루미늄 압출",alu:true},
  A5052 :{su:230,pG:210,act:.5, label:"A5052",   desc:"알루미늄 판",alu:true},
  ADC12 :{su:228,pG:200,act:.5, label:"ADC12",   desc:"알루미늄 다이캐스팅",alu:true},
  FC250 :{su:250,pG:700,act:1,  label:"FC250",   desc:"회주철",shear:1.1},
  POM   :{su:65, pG:60, act:0,  label:"POM",     desc:"엔지니어링 플라스틱"}
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
const NUT_H={3:2.4,4:3.2,5:4.7,6:5.2,8:6.8,10:8.4,12:10.8,14:12.8,16:14.8,20:18};
function nutH(d){
  if(NUT_H[d])return NUT_H[d];
  const k=Object.keys(NUT_H).map(Number).sort((a,b)=>Math.abs(a-d)-Math.abs(b-d))[0];
  return NUT_H[k]*d/k;
}

const KF={
  dry :{k:.20,label:"무윤활 강재",     desc:"K 0.20 · 기본"},
  zinc:{k:.18,label:"아연 도금",       desc:"K 0.18"},
  oil :{k:.15,label:"오일 윤활",       desc:"K 0.15"},
  moly:{k:.12,label:"이황화몰리브덴",   desc:"K 0.12"},
  lock:{k:.19,label:"나사 고정제",     desc:"K 0.19"},
  sus :{k:.28,label:"스테인리스 무윤활",desc:"K 0.28 · 소착 주의"}
};

const WASHER={
  none:{label:"없음",  dhr:0,    desc:"볼트 머리가 직접 접촉"},
  flat:{label:"평와셔", dhr:2.20, desc:"좌면 지름 약 2.2d — 면압 분산"},
  wide:{label:"대형",   dhr:2.80, desc:"좌면 지름 약 2.8d — 연질재용"}
};

const PL_SEG=[65,70,75,90];
const LOAD_SEG=[
  {v:"none",  label:"미입력"},
  {v:"axial", label:"축방향 인장"},
  {v:"shear", label:"횡방향 전단"}
];

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
         "마찰 전달 대신 핀·키·숄더로 전단하중을 직접 받게 한다"]
};

const EMBED    = 0.10;  // 임베딩/이완 손실 10%
const MU_JOINT = 0.15;  // 마찰 전달 접합면 마찰계수
const SF_AXIAL = 1.5;   // 축하중 분리 방지 안전율
const SF_SHEAR = 1.3;   // 횡하중 미끄럼 방지 안전율

const stressArea=(d,p)=>{const x=d-0.938194*p;return PI/4*x*x;};
const tauOf=m=>MAT[m].su*0.6*(MAT[m].shear||1);
const stripArea=(d,Le)=>0.875*PI*d*Le*KNOCK;
const polarMod=(d,p)=>{const d3=d-1.226869*p;return PI*Math.pow(d3,3)/16;};

function bearingDia(d,head,washer){
  const w=WASHER[washer];
  if(w&&w.dhr>0)return w.dhr*d;               // 와셔가 좌면을 지배
  const H=HEAD[head];
  if(H.cone)return null;                       // 원추 좌면 — 미검토
  if(H.iso)return DHEAD[d]||1.65*d;
  return H.dhr?H.dhr*d:null;
}

/* ══════════════════════════════════════════════════════════
   핵심 계산
   ══════════════════════════════════════════════════════════ */
function compute(o,_probe){
  const p=o.pitch, d=o.d, H=HEAD[o.head], M=MAT[o.mat], K=KF[o.k].k;
  const washer=o.washer||"none";

  let cls=o.cls, capped=false;
  if(H.cap&&CLS_RANK.indexOf(cls)>CLS_RANK.indexOf(H.cap)){cls=H.cap;capped=true;}
  const C=CLS[cls];

  const As=stressArea(d,p), Fy=As*C.sy, Fu=As*C.su;

  /* 머리 형상 제한은 축력에 먼저 적용 — 토크와 축력의 정합성 확보 */
  const Fwant = o.preload/100*Fy;      // 제한 전 목표
  const Fhead = Fwant*H.f;             // 머리 제한 반영
  let Feff = Fhead;                    // 최종 적용 축력

  /* 나사산 뽑힘 */
  const hasLe = o.Le>0;
  const Ats    = hasLe?stripArea(d,o.Le):null;
  const Fstrip = hasLe?Ats*tauOf(o.mat):null;
  const LeMin  = Fu/(0.875*PI*d*tauOf(o.mat)*KNOCK);
  const margin = hasLe?Fstrip/Fhead:null;      // 제한 전 기준 = 실제 여유
  let limited=false;
  if(hasLe && Fstrip/STRIP_SF < Feff){ Feff=Fstrip/STRIP_SF; limited=true; }

  const Trec   = K*Feff*d/1000;
  const Tbreak = K*(hasLe?Math.min(Fu*H.f,Fstrip):Fu*H.f)*d/1000;

  /* 축력 산포 (토크 고정, K가 흔들림) */
  const Flo = Feff/(1+K_SCAT), Fhi = Feff/(1-K_SCAT);

  /* 체결 중 조합응력 (인장 + 비틀림) */
  const Wp    = polarMod(d,p);
  const sigma = Feff/As;
  const tau   = TG_FRAC*(K*Feff*d)/Wp;
  const sigEq = Math.sqrt(sigma*sigma + 3*Math.pow(K_TAU*tau,2));
  const util  = sigEq/C.sy;

  /* 좌면 면압 */
  const Db = bearingDia(d,o.head,washer);
  let pBear=null, pRatio=null;
  if(Db){
    const Ab=PI/4*(Db*Db - Math.pow(1.1*d,2));
    pBear = Fhi/Ab;                            // 상한 축력으로 검토
    pRatio= pBear/M.pG;
  }

  /* ── 나사 고정제 · 제거 토크 ─────────────────────────
     T_제거 = 잔존 축력에 의한 마찰분 + 고정제 이탈분
     마찰분: 풀 때는 피치 성분이 반대로 작용 → (K·d − p/2π)
     고정제분: TDS M10 값 × 호칭경 보정 × (실제 물림 / 표준 너트 높이) */
  const L = LOCK[o.lock||"none"];
  const Fserv0 = Feff*(1-EMBED);
  const Tfric = Fserv0*(K*d - p/(2*PI))/1000;
  let Tadh=0, Trem=null, remRatio=null;
  if(L.bk>0){
    const eng = hasLe ? o.Le : nutH(d);
    Tadh = Math.max(L.bk,L.pv) * lockSizeF(d) * (eng/nutH(d)) * (M.act||0.0001);
    Trem = Tfric + Tadh;
  }

  /* 하중 대비 축력 */
  const Fserv = Fserv0;                // 이완 후 잔존 축력
  let Freq=null;
  if(o.loadType!=="none" && o.load>0){
    Freq = o.loadType==="axial" ? SF_AXIAL*o.load : SF_SHEAR*o.load/MU_JOINT;
  }

  if(Trem!==null) remRatio = Trem/Tbreak;
  const threads = hasLe?o.Le/p:null;
  const thinRegime = hasLe && (threads<3 || o.Le<2.5);

  /* 판정이 "적합"으로 바뀌는 최소 Le — Le에 의존하는 검토만 고려 */
  const LeOk = Math.max(
    2.5*Fhead/(0.875*PI*d*tauOf(o.mat)*KNOCK),   // 뽑힘 여유 2.5배
    6*p,                                          // 유효 나사산 6산
    M.thin?4:0,                                   // 박판 모재 최소 물림
    LeMin                                         // 볼트가 먼저 파단하는 조건
  );

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

  if(thinRegime)
    add("bad","모델 적용 범위","박판·소수 나사산 — 판재 함몰/찢김이 지배. 이 계산은 근거가 되지 못합니다","범위 밖","str",FIX.thin);
  else if(hasLe && MAT[o.mat].thin && o.Le<4)
    add("warn","모델 적용 범위","박판 모재에 얕은 물림 — 실물 검증 필요","주의");

  if(util>1.0) add("bad","체결 중 조합응력","인장+비틀림 등가응력이 항복 초과 — 축력 설정을 낮추세요",(util*100).toFixed(0)+"%","str",FIX.util);
  else if(util>0.90) add("warn","체결 중 조합응력","VDI 기준 이용률 90% 초과 — 여유 없음",(util*100).toFixed(0)+"%");
  else add("ok","체결 중 조합응력","항복 이용률 적정",(util*100).toFixed(0)+"%");

  if(!Db) add("na","좌면 면압",HEAD[o.head].cone?"접시머리 원추 좌면 — 이 모델은 검토하지 않습니다":"좌면 형상 미정","—");
  else if(pRatio>1.0) add("bad","좌면 면압","한계 면압 "+M.pG+" MPa 초과 — 모재가 함몰됩니다",Math.round(pBear)+" MPa","str",FIX.bear);
  else if(pRatio>0.85) add("warn","좌면 면압","한계 면압에 근접 ("+M.pG+" MPa)",Math.round(pBear)+" MPa");
  else add("ok","좌면 면압","한계 "+M.pG+" MPa 이내 (좌면 재질=탭 모재 가정)",Math.round(pBear)+" MPa");

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

  if(Freq===null) add("na","작용 하중 대비","하중을 입력하면 필요 축력을 검토합니다","—");
  else if(Fserv<Freq) add("bad","작용 하중 대비","이완 후 잔존 축력 "+Math.round(Fserv).toLocaleString()+" N < 필요 "+Math.round(Freq).toLocaleString()+" N — 축력 부족",(Fserv/Freq).toFixed(2)+"배","str",FIX.load);
  else if(Fserv<Freq*1.2) add("warn","작용 하중 대비","필요 축력을 겨우 만족",(Fserv/Freq).toFixed(2)+"배");
  else add("ok","작용 하중 대비","필요 "+Math.round(Freq).toLocaleString()+" N 대비 충분",(Fserv/Freq).toFixed(2)+"배");

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
  if(!hasLe){
    lvl="idle"; tag="물림 깊이를 맞추세요";
    txt="탭 충분 가정 · 뽑힘·나사산 수는 아직 판정 전";
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

  return{d,p,As,cls,capped,C,H,M,K,washer,Fy,Fu,Fwant,Fhead,Feff,Flo,Fhi,Fserv,Freq,
         Fstrip,Ats,LeMin,LeOk,okPossible,threads,margin,limited,hasLe,Le:o.Le,
         L,Tfric,Tadh,Trem,remRatio,
         Trec,Tbreak,sigma,tau,sigEq,util,Db,pBear,pRatio,
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
  if(!out.head){out.head="std";out.assumed.push("표준 머리 가정");}
  return out;
}

/* ══════════════════════════════════════════════════════════
   사내 시험 데이터
   mat:null = 재질 미상. 시트 표1에는 행별 재질 정보가 없습니다.
   ══════════════════════════════════════════════════════════ */
const MEAS=[
 {use:"Tension Block",        d:4, head:"std", Le:7.4, T:10.50, mat:null},
 {use:"Rear Cover LED",       d:4, head:"cs",  Le:5.0, T:6.59,  mat:null},
 {use:"Planet Reducer",       d:5, head:"std", Le:7.0, T:23.00, mat:null},
 {use:"Motor → Reducer",      d:5, head:"std", Le:5.0, T:21.20, mat:null},
 {use:"Reducer Pulley Plate", d:5, head:"std", Le:12.0,T:24.46, mat:null},
 {use:"Front/Rear Panel",     d:5, head:"cs",  Le:2.0, T:6.40,  mat:null},
 {use:"Plate → Squal Nut",    d:6, head:"std", Le:8.0, T:41.78, mat:null},
 {use:"Driving Module",       d:6, head:"cs",  Le:11.0,T:28.76, mat:null},
 {use:"Driving Module",       d:6, head:"cs",  Le:5.0, T:28.64, mat:null},
 {use:"Fork Bar (A-seg)",     d:8, head:"std", Le:9.6, T:92.30, mat:null},
 {use:"Caster",               d:8, head:"std", Le:7.0, T:84.90, mat:null},
 {use:"Worm Gear → Frame",    d:10,head:"low", Le:12.2,T:79.98, mat:null},
 {use:"전장박스 TAP",          d:3, head:"sems",Le:2.0, T:1.47,  mat:"SPCC", cls:"A2-70", k:"sus"},
 {use:"전장박스 TAP",          d:4, head:"sems",Le:2.0, T:2.04,  mat:"SPCC", cls:"A2-70", k:"sus"}
];
/* 예측값은 사용자 설정과 무관한 상수 — 최초 1회만 계산 */
const MEAS_PRED = MEAS.map(m=>{
  const base={d:m.d,pitch:PITCH[m.d],cls:m.cls||"12.9",head:m.head,k:m.k||"dry",
              washer:"none",preload:70,Le:m.Le,loadType:"none",load:0};
  if(m.mat){
    const r=compute(Object.assign({},base,{mat:m.mat}));
    return {known:true, T:r.Tbreak, dev:(r.Tbreak/m.T-1)*100};
  }
  return {known:false,
          hi:compute(Object.assign({},base,{mat:"S45C"})).Tbreak,
          lo:compute(Object.assign({},base,{mat:"SS400"})).Tbreak};
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
         preload:70,Le:0,loadType:"none",load:0,headAuto:true};
let R=null,P=null,lastDigits="",lastSide=null;

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
    $("vIcon").innerHTML=IC.na;
    ["sForce","sUtil","sBreak","leRead"].forEach(i=>$(i).textContent="—");
    $("draw").innerHTML=""; $("chkList").innerHTML=""; $("chkTags").innerHTML="";
    buildQuick(); return;
  }
  $("err").hidden=true;
  if(S.headAuto&&P.head)S.head=P.head;

  R=compute({d:P.d,pitch:P.pitch,cls:S.cls,head:S.head,mat:S.mat,k:S.k,washer:S.washer,lock:S.lock,
             preload:S.preload,Le:S.Le,loadType:S.loadType,load:S.load});

  if(!fast){
    const chip=(t,c)=>{const e=document.createElement("span");e.className="pill"+(c?" "+c:"");e.textContent=t;pr.appendChild(e);};
    chip("M"+P.d+" × P"+P.pitch,"b");
    chip("As "+f2(R.As)+" mm²");
    chip(R.H.label);
    chip(R.cls+(R.capped?" (규격 상한)":""),R.capped?"w":"");
    if(S.washer!=="none")chip("와셔 "+WASHER[S.washer].label);
    chip(P.len!=null?"길이 "+P.len+" · 토크 무관":"길이 미지정","mute");
    P.assumed.forEach(t=>chip(t,"w"));
  }

  setState(R.lvl);
  setDigits(sig3(R.Trec));
  $("bandWrench").innerHTML="토크렌치 ±10% → <b>"+sig3(R.Trec*.9)+" ~ "+sig3(R.Trec*1.1)+"</b> N·m";
  $("bandForce").innerHTML="실제 축력은 마찰 산포로 <b>"+f0(R.Flo)+" ~ "+f0(R.Fhi)+" N</b> 범위";

  $("verdict").classList.toggle("idle",R.lvl==="idle");
  $("vTitle").textContent=R.tag;
  $("vDesc").textContent=R.txt;
  $("vIcon").innerHTML=R.lvl==="ok"?IC.ok:R.lvl==="bad"?IC.bad:R.lvl==="warn"?IC.warn
    :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5.5v13M6.5 13l5.5 5.5L17.5 13"/></svg>';
  $("vIcon").querySelectorAll("path").forEach(p=>p.setAttribute("stroke","#fff"));

  $("sForce").innerHTML=f0(R.Feff)+'<small>N</small>';
  $("sUtil").innerHTML=(R.util*100).toFixed(0)+'<small>%</small>';
  $("sBreak").innerHTML=sig3(R.Tbreak)+'<small>N·m</small>';

  $("leRead").textContent=R.hasLe?f1(R.Le)+" mm · Le/d "+f2(R.Le/R.d):"미설정";
  $("leNote").textContent=!R.okPossible
    ? "다른 검토 항목이 막고 있어 Le만으로는 적합해지지 않습니다"
    : R.hasLe
      ?(R.threads.toFixed(1)+"산 물림 · 최소 "+f1(R.LeMin)+" / 적합 "+f1(R.LeOk)+" mm")
      :"밀어서 실제 물림 길이를 맞추세요";
  $("leReset").hidden=!R.hasLe;

  renderChecks(); renderRemoval();
  updateSlider(); drawSection();
  if(fast) return;                      // 드래그 중에는 여기서 종료
  buildQuick(); buildSegs(); updateQuickNav(); ensureChipVisible();
  $("vMat").textContent=MAT[S.mat].label;
  $("vHead").textContent=HEAD[S.head].label;
  $("vK").textContent=KF[S.k].label;
  $("vWasher").textContent=WASHER[S.washer].label;
  $("vLock").textContent=LOCK[S.lock].label;
  $("loadClr").hidden=S.loadType==="none";
  writeBasis(); fillMeas();
}

function setState(lvl){
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
  foot.innerHTML+=srcTag("tds","iso4032","own");
}

function renderChecks(){
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
  q.dataset.built="1"; buildQuick();
}

/* 가로 스크롤 상태 → 페이드·화살표 노출 제어 */
function updateQuickNav(){
  const q=$("quick"), w=$("quickWrap");
  if(!q||!w)return;
  const slack=q.scrollWidth-q.clientWidth;
  w.classList.toggle("can-l",slack>2 && q.scrollLeft>2);
  w.classList.toggle("can-r",slack>2 && q.scrollLeft<slack-2);
}
/* 선택된 칩이 잘려 있으면 보이는 위치로 (페이지 스크롤 건드리지 않음) */
function ensureChipVisible(){
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
  btns.forEach((b,i)=>{
    const on=String(items[i])===String(cur);
    b.classList.toggle("on",on);
    if(on){const ind=$(indId); ind.style.left=b.offsetLeft+"px"; ind.style.width=b.offsetWidth+"px";}
  });
}

/* ══════════════════════════════════════════════════════════
   단면도
   ══════════════════════════════════════════════════════════ */
function drawSection(){
  if(!R){$("draw").innerHTML="";return;}
  const W=340,cy=76, plateL=52, blkL=118, blkR=334;
  const rMaj=Math.max(8,Math.min(17,6+R.d*0.9));
  const cap=rMaj*1.45, bh=Math.max(30,rMaj+13);
  const wOn=S.washer!=="none";
  const wThk=wOn?5:0;
  const wRad=wOn?Math.min(bh-2,Math.max(cap*1.25,rMaj*WASHER[S.washer].dhr*0.55)):0;
  const hw=R.H.cone?0:(S.head==="low"?9:16);
  const headR=plateL-wThk;                     // 머리 우측 끝
  const Le=R.hasLe?R.Le:R.LeOk;
  const scale=Math.min(12,(blkR-blkL-34)/Math.max(Le,4));
  const eng=Math.max(16,Le*scale);
  const idle=!R.hasLe;
  const col=idle?"#8593A8":R.lvl==="bad"?"#D92D20":R.lvl==="warn"?"#C77700":"#0B8A5B";
  const g=[]; const N=(x,y)=>x.toFixed(1)+","+y.toFixed(1);

  /* 탭 모재 */
  g.push(`<rect x="${blkL}" y="${cy-bh}" width="${blkR-blkL}" height="${bh*2}" rx="8" fill="#E9EEF4"/>`);
  g.push(`<rect x="${blkL}" y="${cy-rMaj-2}" width="${eng+14}" height="${rMaj*2+4}" rx="3" fill="#F8FAFB"/>`);
  /* 체결 부재 (클램프 판) */
  g.push(`<rect x="${plateL}" y="${cy-bh}" width="${blkL-plateL}" height="${bh*2}" rx="6" fill="#DFE6EF"/>`);
  g.push(`<rect x="${plateL}" y="${cy-rMaj-2.5}" width="${blkL-plateL}" height="${rMaj*2+5}" fill="#F8FAFB"/>`);
  /* 볼트 몸통 */
  g.push(`<rect x="${headR}" y="${cy-rMaj}" width="${blkL-headR+eng}" height="${rMaj*2}" rx="2.5" fill="#BCCDE6"/>`);
  /* 와셔 */
  if(wOn) g.push(`<rect x="${plateL-wThk}" y="${cy-wRad}" width="${wThk}" height="${wRad*2}" rx="1.5" fill="#8FA6C4"/>`);
  /* 머리 */
  if(R.H.cone)
    g.push(`<polygon points="${N(headR-20,cy-cap)} ${N(headR,cy-rMaj)} ${N(headR,cy+rMaj)} ${N(headR-20,cy+cap)}" fill="#2B3A57"/>`);
  else
    g.push(`<rect x="${headR-hw}" y="${cy-cap}" width="${hw}" height="${cap*2}" rx="2.5" fill="#2B3A57"/>`);

  /* 물린 나사산 */
  const n=Math.max(1,Math.min(26,Math.round(Le/R.p)));
  const step=eng/n, rr=Math.max(1.6,Math.min(2.7,step*0.24));
  for(let i=0;i<n;i++){
    const x=blkL+i*step+step*.5;
    g.push(`<circle cx="${x.toFixed(1)}" cy="${cy-rMaj}" r="${rr.toFixed(1)}" fill="${col}"/>`);
    g.push(`<circle cx="${x.toFixed(1)}" cy="${cy+rMaj}" r="${rr.toFixed(1)}" fill="${col}"/>`);
  }
  const strip=R.hasLe&&R.margin<STRIP_SF;
  if(strip){
    g.push(`<line x1="${blkL}" y1="${cy-rMaj-5}" x2="${blkL+eng}" y2="${cy-rMaj-5}" stroke="#D92D20" stroke-width="1.8" stroke-dasharray="3 3" stroke-linecap="round"/>`);
    g.push(`<line x1="${blkL}" y1="${cy+rMaj+5}" x2="${blkL+eng}" y2="${cy+rMaj+5}" stroke="#D92D20" stroke-width="1.8" stroke-dasharray="3 3" stroke-linecap="round"/>`);
  }else if(R.hasLe){
    g.push(`<line x1="${blkL-6}" y1="${cy-rMaj-8}" x2="${blkL-6}" y2="${cy+rMaj+8}" stroke="#8593A8" stroke-width="1.8" stroke-dasharray="3 3" stroke-linecap="round"/>`);
  }
  /* 좌면 압괴 경고 */
  const bear=R.checks.find(c=>c.name==="좌면 면압");
  if(bear&&bear.lvl==="bad")
    g.push(`<path d="M${N(plateL+2,cy-bh-3)} L${N(plateL+2,cy-rMaj-4)}" stroke="#D92D20" stroke-width="2" stroke-linecap="round" stroke-dasharray="2 3"/>`)
    ,g.push(`<text x="${plateL+6}" y="${cy-bh-6}" font-size="9.5" font-weight="700" fill="#D92D20">좌면 압괴</text>`);

  const modeTxt=idle?"":strip?"뽑힘 지배":"볼트 목 파단";
  g.push(`<text x="${blkL+eng/2}" y="${cy-rMaj-14}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${col}">${n}산 물림${modeTxt?" · "+modeTxt:""}</text>`);

  const dy=cy+bh+18;
  g.push(`<path d="M${N(blkL,dy-5)} L${N(blkL,dy+5)} M${N(blkL+eng,dy-5)} L${N(blkL+eng,dy+5)}" stroke="${col}" stroke-width="1.4" stroke-linecap="round"/>`);
  g.push(`<line x1="${blkL}" y1="${dy}" x2="${blkL+eng}" y2="${dy}" stroke="${col}" stroke-width="1.6" stroke-linecap="round"/>`);
  g.push(`<text x="${blkL+eng/2}" y="${dy+17}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${col}">Le ${f1(Le)} mm</text>`);
  if(idle)g.push(`<text x="${blkL+eng/2}" y="${dy+32}" text-anchor="middle" font-size="10" font-weight="600" fill="#8593A8">적합 기준값 · 아직 미설정</text>`);
  if(wOn)g.push(`<text x="${plateL-2}" y="${dy+17}" text-anchor="end" font-size="10" font-weight="600" fill="#5E7290">${WASHER[S.washer].label}</text>`);
  g.push(`<text x="${W-4}" y="14" text-anchor="end" font-size="10.5" font-weight="600" fill="#8593A8">${MAT[S.mat].label} · τu ${Math.round(tauOf(S.mat))} MPa</text>`);
  $("draw").innerHTML=g.join("");
}

/* ══════════════════════════════════════════════════════════
   슬라이더
   ══════════════════════════════════════════════════════════ */
const leMax=()=>P&&!P.err?Math.max(P.d*3.2,8):16;
function updateSlider(){
  if(!R)return;
  const max=leMax(), t=$("track"), w=t.clientWidth||300;
  const at=v=>Math.max(0,Math.min(1,v/max))*w;
  const px=at(R.hasLe?R.Le:R.LeOk);
  $("thumb").style.left=px+"px";
  $("thumb").classList.toggle("ghost",!R.hasLe);
  $("fill").style.width=(R.hasLe?px:0)+"px";

  const pMin=at(R.LeMin), pOk=at(R.LeOk);
  $("tickMin").style.left=pMin+"px";
  $("tickOk").style.left=pOk+"px";
  /* 라벨은 양 끝에서 잘리지 않도록 클램프 */
  const clamp=(x,pad)=>Math.max(pad,Math.min(w-pad,x));
  $("lblMin").style.left=clamp(pMin,20)+"px";
  $("lblOk").style.left=clamp(pOk,32)+"px";
  /* 두 라벨이 겹치면 '최소'를 숨긴다 */
  $("lblMin").classList.toggle("hide",Math.abs(pOk-pMin)<58);
  /* Le만으로는 적합해질 수 없으면 기준선을 흐리고 문구를 바꾼다 */
  $("lblOk").textContent=R.okPossible?"적합 기준":"Le 기준";
  $("lblOk").classList.toggle("blocked",!R.okPossible);
  $("tickOk").classList.toggle("blocked",!R.okPossible);

  t.setAttribute("aria-valuenow",R.hasLe?f1(R.Le):0);
  t.setAttribute("aria-valuemax",f1(max));
  t.setAttribute("aria-valuetext",R.hasLe
    ?f1(R.Le)+"mm, "+R.threads.toFixed(1)+"산, 판정 "+R.tag
    :"미설정, 적합 기준 "+f1(R.LeOk)+"mm");
}
(function slider(){
  const t=$("track"); let drag=false,pid=null;
  const val=x=>{const r=t.getBoundingClientRect();
    return Math.round(Math.max(0,Math.min(1,(x-r.left)/r.width))*leMax()*10)/10;};
  const set=(x,haptic)=>{
    const v=Math.max(.1,val(x));
    const wasOk=R&&R.lvl==="ok";
    S.Le=v; render(true);
    const nowOk=R&&R.lvl==="ok";
    if(haptic&&lastSide!==null&&nowOk!==wasOk){
      const th=$("thumb"); th.classList.add("pulse");
      setTimeout(()=>th.classList.remove("pulse"),260);
      if(navigator.vibrate)try{navigator.vibrate(nowOk?[10,40,16]:12)}catch(e){}
      if(nowOk){                       // 적합 진입 순간에만 "탁!"
        const sn=$("snap"); sn.style.left=th.style.left;
        sn.classList.remove("go"); void sn.offsetWidth; sn.classList.add("go");
      }
    }
    lastSide=nowOk;
  };
  let raf=null,px=null;
  t.addEventListener("pointerdown",e=>{
    drag=true; pid=e.pointerId; lastSide=(R&&R.hasLe)?R.lvl==="ok":null;
    set(e.clientX,false); try{t.setPointerCapture(e.pointerId)}catch(_){} e.preventDefault();
  });
  window.addEventListener("pointermove",e=>{
    if(!drag||(pid!==null&&e.pointerId!==pid))return;
    px=e.clientX;
    if(raf)return;                       // 프레임당 1회로 제한
    raf=requestAnimationFrame(()=>{raf=null;if(drag)set(px,true);});
  },{passive:true});
  const end=()=>{
    if(!drag)return; drag=false; lastSide=null;
    if(raf){cancelAnimationFrame(raf);raf=null;}
    try{if(pid!==null)t.releasePointerCapture(pid)}catch(_){} pid=null;
    render();                            // 드래그 종료 시 전체 갱신
  };
  window.addEventListener("pointerup",end); window.addEventListener("pointercancel",end);
  t.addEventListener("keydown",e=>{
    const st=P&&!P.err?Math.max(.1,Math.round(P.d)/10):.5;
    if(e.key==="ArrowRight"||e.key==="ArrowUp"){S.Le=Math.round((S.Le+st)*10)/10;render();e.preventDefault();}
    if(e.key==="ArrowLeft"||e.key==="ArrowDown"){S.Le=Math.max(0,Math.round((S.Le-st)*10)/10);render();e.preventDefault();}
    if(e.key==="Home"){S.Le=0;render();e.preventDefault();}
  });
})();
$("leReset").onclick=()=>{S.Le=0;render();};

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
  vdi    :{t:2,label:"VDI 2230",        note:"볼트 체결 설계 지침"},
  nutf   :{t:3,label:"nut-factor 관행",  note:"Bickford · Bossard · Bolt Science 계열 K값 — 규격 아님"},
  tds    :{t:3,label:"Henkel TDS",      note:"LOCTITE 제품 데이터시트 (ISO 10964 시험)"},
  own    :{t:4,label:"자체 경험값",      note:"규격 근거 없음 — 실물 시험으로 재교정 필요"}
};
const SRC_TIER=[
  {t:1,star:"★★★★★", name:"공식 표준규격",         ex:"ISO · DIN · JIS · KS"},
  {t:2,star:"★★★★★", name:"볼트 체결 설계 표준",    ex:"VDI 2230"},
  {t:3,star:"★★★★☆", name:"전문 자료 · 제조사 TDS", ex:"Bossard · Bolt Science · Henkel"},
  {t:4,star:"검증 필요",name:"자체 경험 보정값",      ex:"실물 파단 시험으로 재교정해야 함"}
];
const srcTag=(...keys)=>`<span class="srcs">`+keys.map(k=>{
  const s=SRC[k];
  return `<i class="src t${s.t}" title="${esc(s.label+" — "+s.note)}">${esc(s.label)}</i>`;
}).join("")+`</span>`;

function writeBasis(){
  if(!R)return;
  const b=[];
  b.push(`<span class="st">1 · 볼트 유효단면적</span>As = π/4 × (${R.d} − 0.938194 × ${R.p})² = <b>${f2(R.As)} mm²</b>`
    +`<br><span class="mut">0.938194는 유효경 d₂와 골지름 d₃의 평균 계수 — 나사 기본 산형에서 유도됩니다</span>`
    +srcTag("iso898","iso261"));
  b.push(`<span class="st">2 · 강도구분 ${R.cls}</span>σy ${R.C.sy} MPa · σu ${R.C.su} MPa`
    +(R.capped?`<br><span class="wr">${R.H.label} 규격 상한으로 ${S.cls} → ${R.cls} 하향</span>`:"")
    +srcTag(/^A2/.test(R.cls)?"iso3506":"iso898"));
  let s3=`<span class="st">3 · 축력</span>목표 = ${S.preload}% × ${f2(R.As)} × ${R.C.sy} = ${f0(R.Fwant)} N`;
  if(R.H.f<1) s3+=`<br>머리 형상 계수 ×${R.H.f.toFixed(2)} → ${f0(R.Fhead)} N <span class="mut">(경험 근사값)</span>`;
  if(R.limited) s3+=`<br><span class="bad">뽑힘 안전율 ${STRIP_SF.toFixed(1)} 확보를 위해 <b>${f0(R.Feff)} N</b>으로 하향 제한</span>`;
  else s3+=`<br>적용 축력 <b>${f0(R.Feff)} N</b>`;
  s3+=`<br><span class="mut">마찰 산포 ±${K_SCAT*100}% → 실제 ${f0(R.Flo)} ~ ${f0(R.Fhi)} N. `
     +`이 폭은 VDI 2230의 조임계수 αA ≈ 1.8에 해당합니다.<br>`
     +`목표 축력 비율·머리 형상 계수·뽑힘 안전율 ${STRIP_SF.toFixed(1)}은 규격이 아니라 자체 설정값입니다.</span>`
     +srcTag("vdi","own");
  b.push(s3);
  b.push(`<span class="st">4 · 체결토크</span>T = ${R.K} × ${f0(R.Feff)} × ${R.d} = <b>${sig3(R.Trec)} N·m</b>`
    +`<br><span class="mut">K는 나사부 마찰·좌면 마찰·피치 성분을 하나로 묶은 계수입니다. `
    +`VDI 2230은 이걸 M = F[0.16P + 0.58·d₂·μG + (D_Km/2)·μK]로 분리해 다루며, `
    +`<b>T = K·F·d는 규격이 아니라 업계 관행식</b>입니다.</span>`
    +srcTag("nutf"));
  b.push(`<span class="st">5 · 체결 중 조합응력</span>인장 σ = ${R.sigma.toFixed(0)} MPa · 비틀림 τ = ${R.tau.toFixed(0)} MPa<br>`
    +`σeq = √(σ² + 3(0.5τ)²) = <b>${R.sigEq.toFixed(0)} MPa</b> = 항복의 `
    +`<span class="${R.util>1?"bad":R.util>0.92?"wr":"good"}">${(R.util*100).toFixed(0)}%</span>`
    +`<br><span class="mut">등가응력식과 비틀림 감소계수 ${K_TAU}는 VDI 2230. `
    +`나사부 토크 비율 ${TG_FRAC}도 같은 식에서 유도됩니다 (M5 0.50 · M12 0.51).<br>`
    +`단, 단면계수는 골지름 d₃ 기준이라 VDI의 응력지름 기준보다 τ가 약 15~20% 크게 — 보수적으로 나옵니다.</span>`
    +srcTag("vdi","iso261"));
  if(R.hasLe){
    b.push(`<span class="st">6 · 나사산 뽑힘</span>모재 ${R.M.label} · τu = 0.6 × ${R.M.su} = ${Math.round(tauOf(S.mat))} MPa<br>`
      +`Ats = 0.875 × π × ${R.d} × ${f1(R.Le)} × ${KNOCK} = ${f2(R.Ats)} mm²<br>`
      +`탭 내력 <b>${f0(R.Fstrip)} N</b> / 축력 ${f0(R.Fhead)} N = 여유 `
      +`<span class="${R.margin<STRIP_SF?"bad":"good"}">${f2(R.margin)}배</span>`
      +`<br><span class="mut">0.875는 60° 나사 기하에서 유도된 값(0.5 + 0.57735·0.649519/2)이고, `
      +`<b>${KNOCK}만 자체 경험 보정</b>입니다 (문헌 0.6~0.85). τu = 0.6σu도 규격이 아닌 공학 통칙입니다.</span>`
      +srcTag("iso261","jis","own"));
  }else{
    b.push(`<span class="st">6 · 나사산 뽑힘</span><span class="wr">Le 미설정으로 미실시.</span>`);
  }
  if(R.Db){
    const pgStd=PG_VDI.has(S.mat);
    b.push(`<span class="st">7 · 좌면 면압</span>좌면 지름 ${f1(R.Db)} mm${S.washer!=="none"?" (와셔 기준)":""}<br>`
      +`p = ${f0(R.Fhi)} N ÷ 면적 = <b>${Math.round(R.pBear)} MPa</b> / 한계 ${R.M.pG} MPa `
      +`<span class="${R.pRatio>1?"bad":R.pRatio>0.85?"wr":"good"}">(${(R.pRatio*100).toFixed(0)}%)</span>`
      +`<br><span class="mut">축력 상한값으로 보수 검토. 좌면 지름은 ${S.washer!=="none"?"와셔 규격":"ISO 4762 머리 치수"} 기준.<br>`
      +(pgStd
        ? `한계 면압 ${R.M.pG} MPa는 VDI 2230 수록 재질(${R.M.label})과 대응합니다.`
        : `<span class="wr">한계 면압 ${R.M.pG} MPa는 VDI 2230 수록 재질과 직접 대응하지 않는 외삽값입니다 — 원표 대조 필요.</span>`)
      +`</span>`
      +srcTag("vdi",pgStd?"iso4762":"own"));
  }else{
    b.push(`<span class="st">7 · 좌면 면압</span><span class="wr">${R.H.cone?"접시머리 원추 좌면 — 미검토":"좌면 형상 미정"}</span>`);
  }
  if(R.Freq!==null){
    const need=S.loadType==="axial"
      ? `필요 축력 = ${SF_AXIAL} × ${f0(S.load)} N`
      : `필요 축력 = ${SF_SHEAR} × ${f0(S.load)} ÷ μ ${MU_JOINT}`;
    b.push(`<span class="st">8 · 작용 하중 대비</span>${need} = <b>${f0(R.Freq)} N</b><br>`
      +`이완 후 잔존 축력 = ${f0(R.Feff)} × (1 − ${EMBED}) = ${f0(R.Fserv)} N `
      +`<span class="${R.Fserv<R.Freq?"bad":"good"}">(${f2(R.Fserv/R.Freq)}배)</span>`
      +`<br><span class="mut">안전율 ${SF_AXIAL}·${SF_SHEAR}와 이완 손실 ${EMBED*100}%는 자체 설정값입니다 `
      +`(VDI 2230은 이완을 표면거칠기·강성으로 산출합니다).`
      +(S.loadType==="shear"?` 접합면 마찰 μ ${MU_JOINT}는 VDI 2230의 건조 강재 범위(0.10~0.15) <b>상한</b>이라 낙관적인 쪽입니다.`:"")
      +`</span>`
      +srcTag("own","vdi"));
  }
  b.push(`<span class="st">9 · 필요 최소 물림</span>Le,min = <b>${f1(R.LeMin)} mm</b> = ${f2(R.LeMin/R.d)}d`
    +`<br><span class="mut">6번 뽑힘 모델을 "볼트가 먼저 파단"하는 조건으로 역산한 값이라 근거 등급도 6번과 같습니다.</span>`
    +srcTag("iso261","own"));

  const legend=SRC_TIER.map(x=>
    `<div class="lg-row"><i class="src t${x.t}">${x.star}</i>`
    +`<span><b>${esc(x.name)}</b> <span class="mut">${esc(x.ex)}</span></span></div>`).join("");
  $("basis").innerHTML=b.join("<hr>")
    +`<hr><div class="src-legend"><span class="st">근거 등급</span>${legend}`
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
  const rows=MEAS.filter(m=>m.d===R.d), tb=$("measBody");
  $("measCnt").textContent=rows.length?rows.length+"건":"—";
  tb.innerHTML="";
  if(!rows.length){
    tb.innerHTML=`<tr><td colspan="5" class="mut" style="text-align:center;padding:18px">M${R.d} 시험 데이터 없음</td></tr>`;
    $("measSumm").textContent=""; $("measWarn").textContent=""; return;
  }
  const devs=[]; let unknown=0; const html=[];
  MEAS.forEach((m,i)=>{
    if(m.d!==R.d)return;
    const q=MEAS_PRED[i];
    const head=`<td>${m.use}<br><span class="mut" style="font-size:11px">${HEAD[m.head].label} · ${m.mat||"재질 미상"}</span></td>`
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
    $("measSumm").innerHTML=`재질이 확인된 ${devs.length}건 평균 편차 <b>${avg>0?"+":""}${avg.toFixed(0)}%</b>. `
      +`예상 파단은 원리적으로 정밀도가 낮으므로 ±20~40%는 정상 범위입니다.`;
  }else $("measSumm").textContent="";
  $("measWarn").innerHTML=unknown
    ? `<b>${unknown}건은 행별 모재가 기록되어 있지 않습니다.</b> 예상값을 S45C~SS400 범위로만 표시하고 편차는 계산하지 않았습니다. `
      +`알루미늄이면 값이 절반 이하로 내려가 결론이 완전히 뒤집힙니다. <b>행별 재질 기록이 이 시험의 가장 시급한 보완 사항입니다.</b>`
    : "";
}

/* ══════════════════════════════════════════════════════════
   바텀시트
   ══════════════════════════════════════════════════════════ */
let sheetMode=null;
function openSheet(mode){
  sheetMode=mode;
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
    strip("접시·저두·버튼의 제한계수는 규격 실측값이 아니라 경험 근사값입니다.");
    Object.entries(HEAD).forEach(([k,v])=>opt(S.head===k,v.full,v.note,
      ()=>{S.head=k;S.headAuto=false;closeSheet();render();}));
  }else if(mode==="k"){
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
}
function closeSheet(){
  const sh=$("sheet");
  $("scrim").classList.remove("on"); sh.classList.remove("on");
  sh.setAttribute("aria-hidden","true"); sh.setAttribute("inert","");
  document.body.style.overflow=""; sheetMode=null; sh.style.transform="";
}
document.querySelectorAll("[data-sheet]").forEach(b=>b.onclick=()=>openSheet(b.dataset.sheet));
$("scrim").onclick=closeSheet; $("sheetX").onclick=closeSheet;
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&sheetMode)closeSheet();});

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

const bar=$("bar");
addEventListener("scroll",()=>bar.classList.toggle("stuck",scrollY>4),{passive:true});
addEventListener("resize",()=>{updateSlider();buildSegs();updateQuickNav();});

(function init(){
  render();
  requestAnimationFrame(()=>{buildSegs();updateSlider();updateQuickNav();});
})();
