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

- 공식 플러그인의 업데이트 확인은 `pulsia-plugin-updates.json` 한 번으로 처리함. 일반 플러그인·팩·구제품을 현재 ID로 구분하고 설치본의 ZIP 이름, 최신 버전, SHA-256을 비교함. 제작자가 제공한 변경 내역이 있으면 파일 식별자를 함께 제공함.
- `details/stable/<공개 ID>.json`과 시험 버전용 `details/prerelease/<공개 ID>.json`에는 선택한 릴리즈의 manifest, 스토어 상세 정보, ZIP 정보를 보관함. 같은 ID의 다음 버전이 나오면 해당 파일을 교체함.
- `pulsia-plugin-catalog.json`은 제품별 최신 공개 버전과 설치 ZIP의 이름·크기·SHA-256·다운로드 주소를 제공함. 더 높은 시험 버전이 있는 제품은 안정 버전도 유지함. 목록 표시, 설치 관계, 팩 구성과 상세 파일의 SHA-256을 포함함.
- Release 게시·수정·삭제 시 GitHub Actions가 카탈로그를 다시 생성함.
- 매시간 자동 확인을 추가로 실행하여 Release 이벤트로 갱신되지 않은 경우를 복구함.
- 스토어 목록은 이 파일을 먼저 읽고, 읽을 수 없는 저장소에만 GitHub Release API를 사용함.
- `history/<플러그인 ID>.json`에는 버전별 GitHub Release 주소와 ZIP 지문을 보관함. 최신 조회에서는 이력을 내려받지 않음. 플러그인 형식이 아닌 태그는 `history/_other.json`에 보관함.

## 제작자 변경 내역

- ZIP의 `plugin.json`과 같은 루트에 UTF-8 `CHANGELOG.md`를 넣음. 각 버전은 아래와 같이 두 번째 수준 제목으로 구분함.

```markdown
## 1.2.103
- 검색 결과에서 파일을 바로 열 수 있음.

## 1.2.102
- 빈 검색 결과에서 발생한 오류를 수정함.
```

- 새 릴리즈의 ZIP 크기와 SHA-256을 확인한 뒤 배포 버전과 일치하는 절만 `changelogs/<releaseId>-<ZIP SHA-256>.md`에 게시함. 스토어는 링크가 있는 버전에 한해 변경 내역을 열 때 본문을 읽음. 같은 ZIP은 다음 생성 때 재사용함. 파일이나 해당 버전 절이 없으면 변경 내역을 비워 둠.
- 전환 전에 공개된 릴리즈는 버전 이력과 다운로드 주소를 유지하고 변경 내역을 소급 생성하지 않음. GitHub Release와 ZIP 원본은 보존함.
