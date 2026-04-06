// -----------------------------------------------------------------------------
// 요소 가져오기
// -----------------------------------------------------------------------------
const tabIncome = document.getElementById("tabIncome");
const tabExpense = document.getElementById("tabExpense");
const incomeForm = document.getElementById("incomeForm");
const expenseForm = document.getElementById("expenseForm");


// -----------------------------------------------------------------------------
// 탭 전환 기능 (수입 / 지출)
// -----------------------------------------------------------------------------

// "수입" 탭 클릭 시
tabIncome.addEventListener("click", () => {
  tabIncome.classList.add("active");     // 수입 탭 활성화
  tabExpense.classList.remove("active"); // 지출 탭 비활성화
  incomeForm.classList.remove("hidden"); // 수입 입력폼 표시
  expenseForm.classList.add("hidden");   // 지출 입력폼 숨김
});

// "지출" 탭 클릭 시
tabExpense.addEventListener("click", () => {
  tabExpense.classList.add("active");
  tabIncome.classList.remove("active");
  expenseForm.classList.remove("hidden");
  incomeForm.classList.add("hidden");
});


// -----------------------------------------------------------------------------
// 카테고리 목록 불러오기
// DB: category 테이블 (name, type(income/expense))
// -----------------------------------------------------------------------------
async function loadCategories() {
  const res = await fetch("/api/categories");
  const data = await res.json();
  if (!data.success) return alert("카테고리 불러오기 실패");

  // select 요소 가져오기
  const incomeSelect = document.getElementById("incomeCategory");
  const expenseSelect = document.getElementById("expenseCategory");

  // 기본 옵션 추가
  incomeSelect.innerHTML = `<option value="">선택</option>`;
  expenseSelect.innerHTML = `<option value="">선택</option>`;

  // 카테고리 추가
  data.categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat.name;
    opt.textContent = cat.name;

    // type(수입/지출)에 따라 해당 select에 넣음
    if (cat.type === "income") incomeSelect.appendChild(opt);
    else expenseSelect.appendChild(opt);
  });
}


// -----------------------------------------------------------------------------
// 수입 추가 기능 POST /api/records/income
// -----------------------------------------------------------------------------
async function addIncome() {
  const amount = document.getElementById('incomeAmount').value;
  const category = document.getElementById('incomeCategory').value;
  const memo = document.getElementById('incomeMemo').value;
  const date = document.getElementById('incomeDate').value;

  // 필수값 체크
  if (!amount || !category || !date) return alert('필수 입력 누락');

  // 서버로 전송
  const res = await fetch('/api/records/income', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, category, memo, date })
  });

  const data = await res.json();

  // 등록 성공 여부 출력
  alert(data.success ? '수입 등록 완료' : '오류: ' + data.error);

  // 성공 시 화면 갱신 + 입력값 초기화
  if (data.success) {
    updateSummary();     // 요약 데이터 갱신
    loadTodayRecords();  // 오늘 내역 갱신

    // 입력 초기화
    document.getElementById('incomeAmount').value = "";
    document.getElementById('incomeCategory').selectedIndex = 0;
    document.getElementById('incomeMemo').value = "";
    document.getElementById('incomeDate').value = "";
  }
}


// -----------------------------------------------------------------------------
// 지출 추가 기능 POST /api/records/expense
// -----------------------------------------------------------------------------
async function addExpense() {
  const amount = document.getElementById('expenseAmount').value;
  const category = document.getElementById('expenseCategory').value;
  const memo = document.getElementById('expenseMemo').value;
  const date = document.getElementById('expenseDate').value;

  if (!amount || !category || !date) return alert('필수 입력 누락');

  const res = await fetch('/api/records/expense', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, category, memo, date })
  });

  const data = await res.json();

  alert(data.success ? '지출 등록 완료' : '오류: ' + data.error);

  if (data.success) {
    updateSummary();
    loadTodayRecords();

    document.getElementById('expenseAmount').value = "";
    document.getElementById('expenseCategory').selectedIndex = 0;
    document.getElementById('expenseMemo').value = "";
    document.getElementById('expenseDate').value = "";
  }
}


// -----------------------------------------------------------------------------
// 숫자 입력 시 "e" 입력 막기 (input type="number" 기본 문제)
// 브라우저가 숫자 입력창에서 e/E 를 허용하는데, 금액 입력에는 필요 없음
// -----------------------------------------------------------------------------
document.querySelectorAll('input[type="number"]').forEach(input => {
  input.addEventListener('keydown', e => {
    if (['e'].includes(e.key)) e.preventDefault();
  });
});


// -----------------------------------------------------------------------------
// 요약 데이터: 총수입 / 총지출 / 이번달 지출 + 도넛 차트 갱신
// GET /api/summary
// -----------------------------------------------------------------------------
async function updateSummary() {
  const res = await fetch('/api/summary');
  const data = await res.json();
  if (!data.success) return;

  const { total_income, total_expense, month_expense } = data.summary;

  // 잔액 표시 (수입 - 지출)
  document.getElementById("balance").textContent =
    (total_income - total_expense).toLocaleString() + "원";

  // 이번 달 지출 표시
  document.getElementById("monthExpense").textContent =
    month_expense.toLocaleString() + "원";

  // 차트 준비
  const ctx = document.getElementById("financeChart").getContext("2d");

  // 기존 차트 있으면 삭제
  if (window.chartInstance) window.chartInstance.destroy();

  // 새 차트 생성
  window.chartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["수입", "지출"],
      datasets: [{
        data: [total_income, total_expense],
        backgroundColor: ["#00c471", "#e74c3c"] // 수입:초록, 지출:빨강
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } }
    }
  });
}


// -----------------------------------------------------------------------------
// 오늘의 거래 내역 불러오기
// 오늘 날짜 yyyy-mm-dd 생성 → 검색 API 사용
// -----------------------------------------------------------------------------
async function loadTodayRecords() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  const todayStr = `${year}-${month}-${day}`;

  // 날짜로 검색
  const res = await fetch(`/api/records/search?date=${todayStr}`);
  const data = await res.json();

  const container = document.getElementById("todayRecords");
  container.innerHTML = "";

  if (!data.success || data.records.length === 0) {
    container.innerHTML = "<p>오늘의 거래 내역이 없습니다.</p>";
    return;
  }

  // 카드 생성
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
        ${rec.memo || ""}
      </div>
    `;

    container.appendChild(div);
  });
}


// -----------------------------------------------------------------------------
// 초기 실행
// -----------------------------------------------------------------------------
loadCategories();   // 카테고리 select 채우기
updateSummary();    // 잔액/이번달지출/차트 갱신
loadTodayRecords(); // 오늘 수입/지출 표시
