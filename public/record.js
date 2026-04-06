// 거래 내역 불러오기
async function loadRecords(keyword = "") {
  const res = await fetch("/api/records/search?category=" + encodeURIComponent(keyword) +
                          "&memo=" + encodeURIComponent(keyword) +
                          "&date=" + encodeURIComponent(keyword));
  const data = await res.json();
  const container = document.getElementById("recordsList");
  container.innerHTML = "";

  if (!data.success || data.records.length === 0) {
    container.innerHTML = `<p style="text-align:center;">등록된 내역이 없습니다.</p>`;
    return;
  }

  //최신순
  data.records.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);

    // 날짜가 다르면 최신 날짜가 위로
    if (dateA.getTime() !== dateB.getTime()) {
      return dateB - dateA;
    }

    // 날짜가 같으면 id 큰 게 위로 (나중에 추가된)
    return (b.id || 0) - (a.id || 0);
  });

  data.records.forEach(rec => {
    const div = document.createElement("div");
    div.className = `record-card ${rec.type}`;
    div.innerHTML = `
      <div class="record-top">
        <strong>${rec.category}</strong>
        <span class="record-amount ${rec.type}">
          ${rec.type === "income" ? "+" : "-"}${parseInt(rec.amount).toLocaleString()}원
        </span>
      </div>
      <div class="record-bottom">
        <span class="memo">${rec.memo || "메모 없음"}</span>
        <span class="date">${new Date(rec.date).toLocaleDateString()}</span>
        <span>
          <button class="edit-btn">수정</button>
          <button class="delete-btn">삭제</button>
        </span>
      </div>
    `;

    // 삭제 버튼
    div.querySelector(".delete-btn").addEventListener("click", async () => {
      if (!confirm("정말 삭제?")) return;
      const res = await fetch(`/api/records/${rec.type}/${rec.id}`, { method: "DELETE" });
      const delData = await res.json();
      if (delData.success) loadRecords(keyword);
      else alert("삭제 실패: " + delData.error);
    });

    // 수정 버튼
    div.querySelector(".edit-btn").addEventListener("click", () => {
      showEditForm(div, rec, keyword);
    });

    container.appendChild(div);
  });
}

// 한 번에 수정 폼 보여주기
function showEditForm(cardDiv, rec, keyword) {
  const topDiv = cardDiv.querySelector(".record-top");
  const bottomDiv = cardDiv.querySelector(".record-bottom");

  // 기존 내용 숨기기
  topDiv.style.display = "none";
  bottomDiv.style.display = "none";

  // 수정 폼 만들기
  const form = document.createElement("div");
  form.className = "edit-form";
  form.innerHTML = `
    <input type="number" value="${rec.amount}" placeholder="금액">
    <input type="text" value="${rec.category}" placeholder="카테고리">
    <input type="text" value="${rec.memo}" placeholder="메모">
    <input type="date" value="${rec.date.slice(0,10)}">
    <button class="save-btn">저장</button>
    <button class="cancel-btn">취소</button>
  `;
  cardDiv.appendChild(form);

  const [amountInput, categoryInput, memoInput, dateInput] = form.querySelectorAll("input");

  // 저장
  form.querySelector(".save-btn").addEventListener("click", async () => {
    const amount = amountInput.value;
    const category = categoryInput.value;
    const memo = memoInput.value;
    const date = dateInput.value;

    if (!amount || !category || !date) return alert("금액/카테고리/날짜는 필수");

    const res = await fetch(`/api/records/${rec.type}/${rec.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, category, memo, date })
    });

    const data = await res.json();
    if (data.success) loadRecords(keyword);
    else alert("수정 실패: " + data.error);
  });

  // 취소
  form.querySelector(".cancel-btn").addEventListener("click", () => {
    form.remove();
    topDiv.style.display = "";
    bottomDiv.style.display = "";
  });
}

// 검색
const searchInput = document.getElementById("searchInput");
if (searchInput) {
  searchInput.addEventListener("input", () => {
    loadRecords(searchInput.value);
  });
}

// 초기 로드
loadRecords();