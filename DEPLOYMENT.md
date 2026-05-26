# 공개 배포 가이드

## 추천 방식: Render

1. 현재 변경사항을 GitHub 저장소에 commit/push 합니다.
2. Render에서 **New > Blueprint**를 선택합니다.
3. 이 GitHub 저장소를 연결합니다.
4. Render가 `render.yaml`을 읽고 `Dockerfile`로 자동 빌드/배포합니다.
5. 배포가 끝나면 생성된 `https://...onrender.com` 주소를 사용자에게 공유합니다.

앱 경로:

- `/`: 웹 화면
- `/health`: 배포 상태 확인
- `/deconvolve/`: 이미지 업로드 및 정량 분석 API

## Docker 서버에 직접 배포

```bash
docker build -t mt-stain-quantification .
docker run --rm -p 8000:8000 mt-stain-quantification
```

서버에서는 방화벽/프록시 설정 후 공개 도메인으로 연결하면 됩니다.

## 중요

- `http://127.0.0.1:8000`은 내 컴퓨터 전용 주소라서 다른 사람이 사용할 수 없습니다.
- 다른 사용자는 Render, Docker 서버, Cloud Run, Railway 같은 호스팅 서비스의 공개 `https://...` 주소가 필요합니다.
- 이 앱은 업로드된 이미지를 서버 메모리에서 처리하고, 기본적으로 파일로 저장하지 않습니다.
