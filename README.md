# 안방 주소 점검

천안 두정동·성정동·쌍용동·안서동에서 전월세 후보의 주소를 입력해 점검하는 React 웹 앱이다.

```powershell
npm.cmd ci
npm.cmd run dev
```

터미널의 주소를 연다. **천안시 서북구 두정로 146**과 **두정동 698**은 같은 주소로 검색된다. 실거래 검증에 사용한 계약 조건은 단독·다가구 월세, 25㎡, 보증금 500만 원, 월세 45만 원이다.

## 점수

- 가격은 계약 조건을 입력한 뒤 같은 법정동에서 신고된 유사 거래와 비교한다.
- 계약 위험은 건축물대장·등기사항증명서·HUG에서 사용자 본인이 확인한 결과를 반영한다.
- 접근성은 주소 주변 시설을 기준으로 한다. 일부 제공처가 연결되지 않으면 확인된 시설 배점을 표시한다.
- 귀갓길은 천안시 생활방범 CCTV 거리와 야간 현장 확인을 합산한다. 현장 정보가 비어 있으면 CCTV 배점만 보여준다.

## 데이터

| 기능 | 출처 |
| --- | --- |
| 주소 대조 | [우정사업본부 주소 DB](https://www.epost.go.kr/search/zipcode/areacdAddressDown.jsp) 2026-11-09 기준의 시범 지역 주소 |
| 주소 좌표·생활시설 | [카카오맵 REST API](https://developers.kakao.com/docs/ko/kakaomap/rest-api)와 일부 시범 지역의 [OpenStreetMap 공개 자료](https://www.openstreetmap.org/copyright) |
| 버스정류장 | [TAGO](https://www.data.go.kr/data/15096280/standard.do) |
| 건물 주용도 | [건축HUB 건축물대장](https://www.data.go.kr/data/15134735/openapi.do) |
| 시세 | 국토교통부 단독·다가구, 연립·다세대, 아파트 전월세 실거래가 |
| CCTV | `asset/CCTV정보_충남천안시.csv`의 생활방범 CCTV |

OpenStreetMap의 시범 지역 자료는 ODbL을 따른다. 주소 DB에서 도로명과 지번을 대조한다. 일부 주소의 좌표는 공개 지도 자료와 연결되며 나머지는 카카오 주소 조회로 확인한다. 좌표가 없을 때는 거리 점수를 보류한다.

CCTV 파일은 서버 시작 시 읽는다. 새 자료를 받으면 같은 이름으로 교체하고 서버를 다시 시작한다.

서버는 `.env.local`의 키를 사용한다. 다른 환경에서는 `.env.example`을 복사해 서비스별 승인 키를 입력한다. 카카오는 앱의 카카오맵 사용 설정을 켜야 한다. 출처가 다른 키는 `BUILDING_KEY`, `RENT_KEY`, `ROW_RENT_KEY`, `APT_RENT_KEY`, `TAGO_KEY`, `KAKAO_REST_KEY`로 전달한다.

## 확인

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
```

