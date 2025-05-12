// 이미지 저장 요청 처리
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "saveImages") {
    const { images, useAltText, prefix } = request;
    let savedCount = 0;

    try {
      images.forEach((image, index) => {
        // 파일명 생성
        let filename;
        if (useAltText && image.alt) {
          // alt 텍스트가 있고 사용하기로 했다면 alt 텍스트 사용
          filename = sanitizeFilename(image.alt);
        } else if (prefix) {
          // 사용자 지정 접두사가 있다면 사용
          filename = `${prefix}_${index + 1}`;
        } else {
          // 기본 파일명
          filename = `image_${Date.now()}_${index + 1}`;
        }

        // 이미지 URL에서 확장자 추출
        const extension = getExtensionFromUrl(image.src);

        // 다운로드 요청
        chrome.downloads.download({
          url: image.src,
          filename: `${filename}.${extension}`,
          saveAs: false,
        });

        savedCount++;
      });

      sendResponse({ success: true, count: savedCount });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }

    return true; // 비동기 응답을 위해 true 반환
  }
});

// 파일명에 사용할 수 없는 문자 제거
function sanitizeFilename(name) {
  // 파일명에 사용할 수 없는 문자 제거 및 길이 제한
  return name
    .replace(/[\\/:*?"<>|]/g, "_") // 윈도우에서 파일명에 사용할 수 없는 문자 제거
    .replace(/\s+/g, "_") // 공백을 언더스코어로 변경
    .substring(0, 100); // 길이 제한
}

// URL에서 확장자 추출
function getExtensionFromUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;
    const lastDotIndex = pathname.lastIndexOf(".");

    if (lastDotIndex !== -1) {
      return pathname.substring(lastDotIndex + 1).toLowerCase();
    }
  } catch (e) {
    // URL 파싱 오류
  }

  // 확장자를 찾을 수 없는 경우 기본값
  return "jpg";
}
