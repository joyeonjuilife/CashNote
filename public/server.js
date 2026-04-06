// --- 기본 모듈 로드 ---
// http : 기본 웹 서버 생성
// mysql : DB 연결 및 쿼리 실행
// fs : 파일 읽기
// path : 파일 경로 관리
const http = require("http");
const mysql = require("mysql");
const fs = require("fs");
const path = require("path");

// --- MySQL 커넥션 풀 설정 ---
// connection pool은 여러 요청이 와도 커넥션을 재사용해 성능을 높인다.
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "0216",
  database: "cashnote_db",
});

const PORT = 3000;

// ---------------------------------------------------------------------------
// 정적 파일을 제공하는 함수
// ---------------------------------------------------------------------------
function serveFile(res, filePath, type) {
  fs.readFile(path.join(__dirname, filePath), (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("File not found");
      return;
    }
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

// ---------------------------------------------------------------------------
// HTTP 서버 생성
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  // ------------------------- GET 요청 처리 -------------------------
  if (req.method === "GET") {
    // 메인 페이지
    if (req.url === "/" || req.url === "/index.html")
      return serveFile(res, "index.html", "text/html");

    // 기록 입력 페이지
    if (req.url === "/record.html")
      return serveFile(res, "record.html", "text/html");

    // JS, CSS 정적 파일 제공
    if (req.url === "/main.js")
      return serveFile(res, "main.js", "text/javascript");

    if (req.url === "/record.js")
      return serveFile(res, "record.js", "text/javascript");

    if (req.url === "/style.css")
      return serveFile(res, "style.css", "text/css");

    // ------------------------- 전체 내역 조회 -------------------------
    if (req.url === "/api/records") {
      // income + expense 테이블을 합쳐서 정렬해서 반환
      const query = `
        SELECT id, amount, category, memo, date, 'income' AS type FROM income
        UNION ALL
        SELECT id, amount, category, memo, date, 'expense' AS type FROM expense
        ORDER BY date DESC
      `;

      pool.query(query, (err, results) => {
        if (err)
          return res.end(
            JSON.stringify({ success: false, error: err.message })
          );

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, records: results }));
      });
      return;
    }

    // ------------------------- 카테고리 목록 -------------------------
    if (req.url.startsWith("/api/categories")) {
      pool.query("SELECT * FROM category", (err, results) => {
        if (err)
          return res.end(
            JSON.stringify({ success: false, error: err.message })
          );

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, categories: results }));
      });
      return;
    }

    // ------------------------- 검색 기능 -------------------------
    if (req.url.startsWith("/api/records/search")) {
      const urlObj = new URL(req.url, `http://${req.headers.host}`);

      // 검색 조건 (없으면 빈 문자열)
      const category = urlObj.searchParams.get("category") || "";
      const memo = urlObj.searchParams.get("memo") || "";
      const date = urlObj.searchParams.get("date") || "";

      // 두 테이블을 같은 조건으로 검색
      const query = `
        SELECT id, amount, category, memo, date, 'income' AS type FROM income
        WHERE category LIKE ? AND memo LIKE ? AND date LIKE ?
        UNION ALL
        SELECT id, amount, category, memo, date, 'expense' AS type FROM expense
        WHERE category LIKE ? AND memo LIKE ? AND date LIKE ?
        ORDER BY date DESC
      `;

      const values = [
        `%${category}%`,
        `%${memo}%`,
        `%${date}%`,
        `%${category}%`,
        `%${memo}%`,
        `%${date}%`,
      ];

      pool.query(query, values, (err, results) => {
        if (err)
          return res.end(
            JSON.stringify({ success: false, error: err.message })
          );

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, records: results }));
      });
      return;
    }

    // ------------------------- 메인 요약 정보 -------------------------
    if (req.url === "/api/summary") {
      const query = `
        SELECT
          (SELECT IFNULL(SUM(amount),0) FROM income) AS total_income,
          (SELECT IFNULL(SUM(amount),0) FROM expense) AS total_expense,
          (SELECT IFNULL(SUM(amount),0) FROM expense 
           WHERE MONTH(date)=MONTH(CURDATE()) AND YEAR(date)=YEAR(CURDATE())) AS month_expense
      `;

      pool.query(query, (err, results) => {
        if (err)
          return res.end(
            JSON.stringify({ success: false, error: err.message })
          );

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, summary: results[0] }));
      });
      return;
    }
  }

  // ------------------------- POST : 수입 등록 -------------------------
  if (req.method === "POST" && req.url === "/api/records/income") {
    let body = "";

    req.on("data", (chunk) => (body += chunk));

    req.on("end", () => {
      const data = JSON.parse(body);

      pool.query(
        "INSERT INTO income (amount, category, memo, date) VALUES (?, ?, ?, ?)",
        [data.amount, data.category, data.memo, data.date],
        (err) => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: !err, error: err?.message }));
        }
      );
    });
    return;
  }

  // ------------------------- POST : 지출 등록 -------------------------
  if (req.method === "POST" && req.url === "/api/records/expense") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const data = JSON.parse(body);

      pool.query(
        "INSERT INTO expense (amount, category, memo, date) VALUES (?, ?, ?, ?)",
        [data.amount, data.category, data.memo, data.date],
        (err) => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: !err, error: err?.message }));
        }
      );
    });
    return;
  }

  // ------------------------- PUT : 데이터 수정 -------------------------
  // 요청 형태 예시: /api/records/income/3
  if (req.method === "PUT" && req.url.startsWith("/api/records/")) {
    const parts = req.url.split("/");

    // parts[3] = income 또는 expense
    // parts[4] = 수정할 id
    const type = parts[3];
    const id = parts[4];

    let body = "";
    req.on("data", (chunk) => (body += chunk));

    req.on("end", () => {
      const data = JSON.parse(body);

      pool.query(
        `UPDATE ${type} SET amount=?, category=?, memo=?, date=? WHERE id=?`,
        [data.amount, data.category, data.memo, data.date, id],
        (err) => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: !err, error: err?.message }));
        }
      );
    });
    return;
  }

  // ------------------------- DELETE : 삭제 -------------------------
  if (req.method === "DELETE" && req.url.startsWith("/api/records/")) {
    const parts = req.url.split("/");
    const type = parts[3]; // income or expense
    const id = parts[4];

    pool.query(`DELETE FROM ${type} WHERE id=?`, [id], (err) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: !err, error: err?.message }));
    });
    return;
  }

  // ------------------------- 기타 경로 처리 -------------------------
  res.writeHead(404);
  res.end("Not Found");
});

// 서버 실행
server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
