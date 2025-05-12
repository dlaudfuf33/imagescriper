document.addEventListener("DOMContentLoaded", () => {
  // DOM 요소 초기화 및 이벤트 핸들러 설정
  const fetchImagesBtn = document.getElementById("fetchImages");
  const saveSelectedBtn = document.getElementById("saveSelected");
  const selectAllBtn = document.getElementById("selectAll");
  const deselectAllBtn = document.getElementById("deselectAll");
  const imageContainer = document.getElementById("imageContainer");
  const statusElement = document.getElementById("status");
  const customNamePrefix = document.getElementById("customNamePrefix");
  const minWidthInput = document.getElementById("minWidth");
  const minHeightInput = document.getElementById("minHeight");
  const toggleAltTextBtn = document.getElementById("toggleAltText");
  let useAltText = true;
  customNamePrefix.disabled = true;

  // alt 속성 사용 여부 토글 버튼 처리
  toggleAltTextBtn.addEventListener("click", () => {
    useAltText = !useAltText;
    toggleAltTextBtn.classList.toggle("active", useAltText);
    toggleAltTextBtn.textContent = useAltText ? "alt 속성" : "직접 입력";
    customNamePrefix.disabled = useAltText;
  });

  let activeExtensions = new Set();

  let images = [];

  // 현재 탭에서 이미지 긁어오고 표시하는 함수
  fetchImagesBtn.addEventListener("click", async () => {
    statusElement.textContent = "이미지를 가져오는 중...";
    imageContainer.innerHTML = "";

    try {
      // 현재 활성화된 탭에서 스크립트 실행
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const minWidth = parseInt(minWidthInput.value, 10) || 0;
      const minHeight = parseInt(minHeightInput.value, 10) || 0;

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: getImagesFromPage,
        args: [minWidth, minHeight],
      });

      images = results[0].result;

      if (images.length === 0) {
        statusElement.textContent = "이미지를 찾을 수 없습니다.";
        return;
      }

      displayImages(images);
      statusElement.textContent = `${images.length}개의 이미지를 찾았습니다.`;

      saveSelectedBtn.disabled = false;
      selectAllBtn.disabled = false;
      deselectAllBtn.disabled = false;
    } catch (error) {
      statusElement.textContent = `오류: ${error.message}`;
    }
  });

  // 선택된 이미지를 저장하는 함수
  saveSelectedBtn.addEventListener("click", () => {
    const selectedImages = getSelectedImages();

    if (selectedImages.length === 0) {
      statusElement.textContent = "선택된 이미지가 없습니다.";
      return;
    }

    const prefix = customNamePrefix.value.trim();

    saveImages(selectedImages, useAltText, prefix);
  });

  // 전체 이미지 선택하는 함수
  selectAllBtn.addEventListener("click", () => {
    const checkboxes = document.querySelectorAll(".image-checkbox");
    checkboxes.forEach((checkbox) => {
      checkbox.checked = true;
      checkbox.closest(".image-item").classList.add("selected");
    });
  });

  // 전체 이미지 선택 해제하는 함수
  deselectAllBtn.addEventListener("click", () => {
    const checkboxes = document.querySelectorAll(".image-checkbox");
    checkboxes.forEach((checkbox) => {
      checkbox.checked = false;
      checkbox.closest(".image-item").classList.remove("selected");
    });
  });

  // 필터 조건 및 확장자 버튼 기반으로 이미지를 필터링하고 표시하는 함수
  function displayImages(allImages) {
    const minWidth = parseInt(minWidthInput.value, 10) || 0;
    const minHeight = parseInt(minHeightInput.value, 10) || 0;

    // --- 확장자 버튼 영역 생성 ---
    const extButtonsContainer = document.getElementById("extButtons");
    const allExts = [
      ...new Set(
        allImages
          .map((img) => {
            try {
              const url = new URL(img.src);
              return url.pathname.split(".").pop().toLowerCase();
            } catch {
              return null;
            }
          })
          .filter(Boolean)
      ),
    ];

    extButtonsContainer.innerHTML = "";
    allExts.forEach((ext) => {
      const btn = document.createElement("button");
      btn.textContent = ext;
      btn.className =
        "ext-btn" + (activeExtensions.has(ext) ? " active" : " inactive");
      btn.addEventListener("click", () => {
        if (activeExtensions.has(ext)) {
          activeExtensions.delete(ext);
        } else {
          activeExtensions.add(ext);
        }
        displayImages(images);
      });
      extButtonsContainer.appendChild(btn);
    });
    // --------------------------

    // 필터: 확장자 버튼 기준
    const imagesToShow = allImages.filter((img) => {
      try {
        const url = new URL(img.src);
        const ext = url.pathname.split(".").pop().toLowerCase();
        return (
          img.width >= minWidth &&
          img.height >= minHeight &&
          (activeExtensions.size === 0 || activeExtensions.has(ext))
        );
      } catch {
        return false;
      }
    });

    imageContainer.innerHTML = "";

    // 쉬프트 클릭 선택
    let lastSelectedIndex = null;
    imagesToShow.forEach((image, index) => {
      const imageItem = document.createElement("div");
      imageItem.className = "image-item";
      imageItem.dataset.index = index;

      const img = document.createElement("img");
      img.src = image.src;
      img.alt = image.alt || `이미지 ${index + 1}`;

      const info = document.createElement("div");
      info.className = "image-info";
      info.innerHTML = `
        해상도: ${image.width}×${image.height}<br />
        <div class="image-url">${image.src}</div>
      `;

      imageItem.appendChild(img);
      imageItem.appendChild(info);
      imageContainer.appendChild(imageItem);

      // 이미지 블록 클릭 시 선택 토글 및 shift-click 지원
      imageItem.addEventListener("click", (event) => {
        const currentIndex = parseInt(imageItem.dataset.index, 10);

        if (event.shiftKey && lastSelectedIndex !== null) {
          const start = Math.min(lastSelectedIndex, currentIndex);
          const end = Math.max(lastSelectedIndex, currentIndex);
          document.querySelectorAll(".image-item").forEach((el) => {
            const idx = parseInt(el.dataset.index, 10);
            if (idx >= start && idx <= end) {
              el.classList.add("selected");
            }
          });
        } else {
          imageItem.classList.toggle("selected");
        }

        lastSelectedIndex = currentIndex;
      });
    });
  }

  // 필터 입력 변경 시 이미지 다시 표시
  [minWidthInput, minHeightInput].forEach((input) => {
    input.addEventListener("input", () => displayImages(images));
  });

  // 현재 선택된 이미지 목록을 반환하는 함수
  function getSelectedImages() {
    const selectedItems = document.querySelectorAll(".image-item.selected");
    return Array.from(selectedItems).map((item) => {
      const index = parseInt(item.dataset.index, 10);
      return images[index];
    });
  }

  // 백그라운드 스크립트에 저장 요청을 보내는 함수
  function saveImages(images, useAltText, prefix) {
    statusElement.textContent = "이미지 저장 중...";

    chrome.runtime.sendMessage(
      {
        action: "saveImages",
        images: images,
        useAltText: useAltText,
        prefix: prefix,
      },
      (response) => {
        if (response.success) {
          statusElement.textContent = `${response.count}개의 이미지가 저장되었습니다.`;
        } else {
          statusElement.textContent = `오류: ${response.error}`;
        }
      }
    );
  }
});

// content script에서 페이지 내 이미지 정보를 수집하는 함수
function getImagesFromPage(minWidth, minHeight) {
  const imgElements = document.querySelectorAll("img");
  const images = [];

  imgElements.forEach((img) => {
    if (img.src && img.width >= minWidth && img.height >= minHeight) {
      images.push({
        src: img.src,
        alt: img.alt || "",
        width: img.width,
        height: img.height,
      });
    }
  });

  return images;
}
