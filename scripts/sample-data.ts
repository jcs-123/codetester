/** Demo data shared by dev-samples.ts (writes .xlsx files) and dev-seed-demo.ts (loads the DB). */
import { buildWorkbook } from "../lib/excel/cells";
import { FACULTY_COLUMNS, STUDENT_COLUMNS } from "../lib/excel/parse-users";
import { QUESTION_COLUMNS } from "../lib/excel/templates";

const cols = (h: readonly string[]) => h.map((header) => ({ header }));

const firstNames = ["Arjun", "Beena", "Farhan", "Gauri", "Hari", "Irfan", "Jyothi", "Kiran", "Lakshmi", "Manu", "Nadia", "Om", "Priya", "Rahul", "Sana", "Tara", "Uday", "Vidya", "Wasim", "Yamuna"];
const lastNames = ["R", "Thomas", "K", "Nair", "Menon", "Sebastian", "Pillai", "Varghese", "Joseph", "Das"];

export const students: (string | number)[][] = [];
let n = 1;
for (const [dept, batch] of [["CSE", "A"], ["CSE", "B"], ["ECE", "A"]] as const) {
  for (let i = 0; i < 20; i++) {
    const id = `JEC22${dept.slice(0, 2)}${String(n).padStart(3, "0")}`;
    const name = `${firstNames[i % firstNames.length]} ${lastNames[(i * 7 + n) % lastNames.length]}`;
    students.push([id, name, `${id.toLowerCase()}@jecc.ac.in`, dept, 5, batch, 2022, `Student@${1000 + n}`]);
    n++;
  }
}

export const faculty: (string | number)[][] = [
  ["JEC1001", "Dr. Anitha Menon", "anitha.m@jecc.ac.in", "CSE", "Associate Professor", "Faculty@1001"],
  ["JEC1002", "Prof. Ramesh Kumar", "ramesh.k@jecc.ac.in", "CSE", "Assistant Professor", "Faculty@1002"],
  ["JEC1003", "Dr. Sheela Varghese", "sheela.v@jecc.ac.in", "ECE", "Professor", "Faculty@1003"],
];

export const studentsWithErrors: (string | number)[][] = [
  ...students.slice(0, 3),
  ["JEC22CS001", "Duplicate Id", "dup@jecc.ac.in", "CSE", 5, "A", 2022, "Student@9999"],
  ["JEC22CS999", "Bad Email", "not-an-email", "CSE", 5, "A", 2022, "Student@9999"],
  ["JEC22CS998", "Bad Semester", "sem@jecc.ac.in", "CSE", 9, "A", 2022, "Student@9999"],
  ["JEC22CS997", "Weak Password", "weak@jecc.ac.in", "CSE", 5, "A", 2022, "short"],
];

export const questions: (string | number)[][] = [
  [1, "Which data structure uses LIFO order?", "Queue", "Stack", "Linked list", "Tree", "Think of a pile of plates.", "B", "A stack removes the most recently added item first."],
  [2, "Time complexity of binary search on a sorted array of n items?", "O(n)", "O(n log n)", "O(log n)", "O(1)", "", "C", "Each step halves the search space."],
  [3, "Which of these is NOT a relational database?", "PostgreSQL", "MySQL", "MongoDB", "Oracle", "", "C", "MongoDB is a document store."],
  [4, "In Big-O notation, which grows fastest?", "O(n)", "O(n log n)", "O(n^2)", "O(2^n)", "Exponential beats polynomial.", "D", ""],
  [5, "What does HTTP status 404 mean?", "OK", "Not Found", "Forbidden", "Server Error", "", "B", ""],
  [6, "Which layer of the OSI model handles routing?", "Transport", "Network", "Data link", "Session", "", "B", "Routers work at layer 3."],
  [7, "A binary tree with n nodes has how many null links?", "n", "n-1", "n+1", "2n", "", "C", "2n links total, n-1 used."],
  [8, "Which sorting algorithm is stable?", "Quick sort", "Heap sort", "Merge sort", "Selection sort", "", "C", ""],
  [9, "SQL keyword to remove duplicate rows from a result?", "UNIQUE", "DISTINCT", "SEPARATE", "SINGLE", "", "B", ""],
  [10, "What is the value of 0b1010 in decimal?", "8", "10", "12", "5", "", "B", "1010 = 8 + 2."],
];

export const studentsWorkbook = () => buildWorkbook([{ name: "Students", columns: cols(STUDENT_COLUMNS), rows: students }]);
export const facultyWorkbook = () => buildWorkbook([{ name: "Faculty", columns: cols(FACULTY_COLUMNS), rows: faculty }]);
export const studentsWithErrorsWorkbook = () =>
  buildWorkbook([{ name: "Students", columns: cols(STUDENT_COLUMNS), rows: studentsWithErrors }]);
export const questionsWorkbook = () => buildWorkbook([{ name: "Questions", columns: cols(QUESTION_COLUMNS), rows: questions }]);
