# pulsia-plugin-releases

Pulsia 플러그인 OTA 배포용 공개 저장소임.

## 역할

- Pulsia 플러그인의 설치 ZIP과 버전별 Release를 배포함.
- 여러 Pulsia 플러그인이 하나의 저장소를 함께 사용함.
- 플러그인별 tag prefix와 asset 이름으로 구분함.

## 운영 기준

- 소스 저장소가 아니라 배포 전용 저장소로 사용함.
- 각 플러그인 소스 저장소는 private 유지 가능함.
- 기존 Release/tag를 덮어쓰지 않고 새 버전으로 추가함.
- 플러그인별 최신 버전 판단은 전체 `latest`가 아니라 플러그인 식별자/tag prefix 기준으로 처리함.
- 배포 자산은 서명/해시 검증을 추가할 수 있는 구조로 유지함.

## 정적 카탈로그

- `pulsia-plugin-catalog.json`이 공개된 모든 Release와 설치 ZIP의 이름·크기·SHA-256·다운로드 주소를 제공함.
- Release 게시·수정·삭제 시 GitHub Actions가 카탈로그를 다시 생성함.
- 매시간 자동 확인을 추가로 실행하여 Release 이벤트로 갱신되지 않은 경우를 복구함.
- Pulsia는 이 파일을 먼저 읽고, 읽을 수 없는 저장소에만 GitHub Release API를 사용함.
- 카탈로그에는 설치 가능한 후보 전체가 들어가며, Pulsia가 안정 버전·ZIP 수·SHA-256·실제 패키지 내용을 다시 검사함.
