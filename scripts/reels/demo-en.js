function demoData() {
  const d = DEFAULT(), now = Date.now(), day = 864e5, at = n => iso(new Date(now + n * day));
  const S = [["s1", "Math", "#2563eb"], ["s2", "Biology", "#0e9f6e"], ["s3", "History", "#ff6a3d"], ["s4", "Spanish", "#8b5cf6"]];
  d.profile = Object.assign(d.profile, { name: "Alex", onboarded: true, level: "school", scale: "pct" });
  d.subjects = S.map(([id, name, color]) => ({ id, name, color }));
  d.folders = S.map(([id, name, color]) => ({ id: "f" + id, name, parent: "", color, subjectId: id })); d.foldersInit = true;
  const note = (id, title, sid, text, ago, extra = {}) => ({ id, type: "note", title, subjectId: sid, folderId: "f" + sid, paper: "white", updated: now - ago * 36e5, created: now - ago * 36e5 - day, text, ...extra });
  d.docs = [
    note("d1", "Cell respiration explained", "s2", "Inside the mitochondria, glucose and oxygen are turned into carbon dioxide and water. This releases ATP, the energy currency of the cell.", 2, { pinned: true }),
    note("d2", "Pythagorean theorem", "s1", "a² + b² = c² – in every right triangle, the squares of the two legs add up to the square of the hypotenuse.", 5),
    note("d3", "Derivatives cheat sheet", "s1", "Power rule, product rule, chain rule and practice examples.", 26),
    note("d4", "The French Revolution", "s3", "Causes, key events from 1789 to 1799 and the rise of Napoleon.", 30),
    note("d5", "Unit 4 – Travel vocabulary", "s4", "Key words and phrases for travelling.", 50),
  ];
  d.docs.forEach(x => { if (x.type === "note") KV.mem.set("html:" + x.id, `<h1>${x.title}</h1><p>${x.text}</p>`); });
  d.tasks = [
    { id: "t1", title: "Worksheet p. 54, Ex. 3–7", type: "hw", due: at(1), subjectId: "s1", note: "", done: false },
    { id: "t2", title: "Prepare biology presentation", type: "task", due: at(0), subjectId: "s2", note: "", done: false },
    { id: "t3", title: "Learn Unit 4 vocab", type: "task", due: at(0), subjectId: "s4", note: "", done: true },
    { id: "t4", title: "Math exam", type: "exam", due: at(6), subjectId: "s1", note: "Chapters 3–5", done: false },
    { id: "t5", title: "History essay due", type: "hw", due: at(3), subjectId: "s3", note: "", done: false },
  ];
  const lesson = (day, start, end, sid, room) => ({ id: "l" + day + start, day, start, end, subjectId: sid, title: S.find(x => x[0] === sid)[1], room });
  d.tt = [0, 1, 2, 3, 4].flatMap(k => [lesson(k, "08:00", "08:45", ["s1", "s2", "s3", "s1", "s4"][k], "A" + (10 + k)), lesson(k, "09:00", "09:45", ["s4", "s1", "s2", "s3", "s1"][k], "B" + (20 + k)), lesson(k, "10:15", "11:00", ["s3", "s4", "s1", "s2", "s2"][k], "C" + (30 + k))]);
  d.decks = [
    { id: "k1", title: "Cell respiration", subjectId: "s2", cards: [["Where does cell respiration happen?", "In the mitochondria"], ["What is ATP?", "The energy currency of the cell"], ["What goes in?", "Glucose and oxygen"], ["What comes out?", "CO₂, water and energy"], ["Respiration without oxygen is called…", "Anaerobic respiration"], ["Where is most ATP made?", "In the electron transport chain"]].map(([q, a], i) => ({ id: "c" + i, q, a, box: 1, due: at(0) })) },
    { id: "k2", title: "Spanish – Travel", subjectId: "s4", cards: [["the journey", "el viaje"], ["the luggage", "el equipaje"], ["the delay", "el retraso"], ["to book", "reservar"]].map(([q, a], i) => ({ id: "v" + i, q, a, box: 1, due: at(i < 2 ? 0 : 3) })) },
    { id: "k3", title: "French Revolution", subjectId: "s3", cards: [["When was the Storming of the Bastille?", "14 July 1789"], ["Who led the Reign of Terror?", "Robespierre"], ["What ended the Revolution?", "Napoleon's coup in 1799"]].map(([q, a], i) => ({ id: "h" + i, q, a, box: 2, due: at(1) })) },
  ];
  d.grades = [["s1", "Functions test", 92, 2, -12], ["s1", "Geometry quiz", 85, 1, -30], ["s2", "Cell biology test", 88, 1, -9], ["s3", "Essay: Revolutions", 94, 1, -5], ["s3", "Oral presentation", 90, 1, -20], ["s4", "Vocab quiz 3", 96, 1, -4]].map(([sid, title, value, weight, n], i) => ({ id: "g" + i, subjectId: sid, title, value, weight, date: at(n) }));
  d.stats = { days: { [at(0)]: 38, [at(-1)]: 45, [at(-2)]: 62, [at(-3)]: 35, [at(-4)]: 50, [at(-5)]: 24, [at(-6)]: 55 }, reviews: {} };
  return d;
}
