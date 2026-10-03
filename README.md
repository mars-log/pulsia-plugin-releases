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
