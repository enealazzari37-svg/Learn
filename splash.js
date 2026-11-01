/* Studix Start-Animation (kurz: Logo, dann klappt der Schriftzug aus). Läuft einmal pro Browser-Tab; Klick, Taste oder Esc überspringt sie. */
(function () {
  if (/[?&]embed=1/.test(location.search)) return;
  var S; try { if (sessionStorage.getItem("lumi-splash") === "1") return; sessionStorage.setItem("lumi-splash", "1"); } catch (e) {}
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, root = document.createElement("div");
  root.id = "splash"; root.setAttribute("aria-hidden", "true");
  root.innerHTML = '<div class="sp-stage"></div>'; document.body.appendChild(root);
  /* Ohne Anmeldung folgt die Login-Seite: Animation nur links, rechts steht schon das Bild */
  var guest = false; try { guest = innerWidth > 860 && /^#\/app/.test(location.hash) && !Object.keys(localStorage).some(function (k) { return /^sb-.*-auth-token$/.test(k) && localStorage.getItem(k); }); } catch (e) {}
  guest = false;   // Login-Seite: Panel mit App-Vorschau links, kein Foto rechts mehr
  if (guest) { root.classList.add("lg"); var hero = document.createElement("div"); hero.className = "sp-hero"; root.appendChild(hero); }
  var st = root.firstChild, done = false, loaded = document.readyState === "complete";
  addEventListener("load", function () { loaded = true; });
  var lock = document.createElement("div"); lock.className = "sp-lock"; lock.innerHTML = '<div class="sp-logo"></div><div class="sp-word">' + "Studix".split("").map(function (ch) { return "<span>" + ch + "</span>"; }).join("") + "</div>"; st.appendChild(lock);
  var logo = lock.firstChild, word = lock.lastChild, ease = "cubic-bezier(.2,.9,.25,1)";
  var A = function (el, kf, o) { if (!el.animate) { var l = kf[kf.length - 1]; for (var p in l) if (p !== "offset") el.style[p] = l[p]; return { finished: Promise.resolve() }; } o.fill = "forwards"; return el.animate(kf, o); };
  var wait = function (ms) { return new Promise(function (res) { setTimeout(res, ms); }); };
  function finish() { if (done) return; done = true; var a = A(root, [{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: "ease" }); (a.finished || wait(420)).then(function () { root.remove(); }); root.classList.add("out"); }
  ["click", "keydown", "touchstart"].forEach(function (ev) { root.addEventListener(ev, finish, { once: true }); addEventListener("keydown", function (e) { if (e.key === "Escape") finish(); }); });
  async function play() {
    var w = 0;
    if (!reduce) {   // nur Logo (mit kurzer Animation), danach klappt der Schriftzug aus
      A(logo, [{ opacity: 0, transform: "scale(.6) rotate(-8deg)" }, { opacity: 1, transform: "scale(1.06) rotate(0)", offset: .7 }, { opacity: 1, transform: "scale(1)" }], { duration: 800, easing: ease });
      await wait(800);
    } else A(logo, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease" });
    if (done) return;
    w = word.scrollWidth + 14; var spans = word.children;
    A(word, [{ maxWidth: "0px" }, { maxWidth: w + "px" }], { duration: reduce ? 1 : 900, easing: "cubic-bezier(.3,.8,.2,1)" });
    for (var i = 0; i < spans.length; i++) A(spans[i], [{ opacity: 0, transform: "translateX(-18px)", filter: "blur(6px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }], { duration: reduce ? 1 : 640, delay: reduce ? 0 : 150 + i * 100, easing: ease });
    await wait(reduce ? 500 : 1500);
    var t0 = Date.now(); while (!loaded && Date.now() - t0 < 4000 && !done) await wait(80);
    finish();
  }
  play();
})();
