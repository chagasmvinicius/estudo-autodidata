// Parser CSV (RFC4180) — lida com campos entre aspas, vírgulas e aspas escapadas ("")
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  // remove BOM se existir
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c === "\r") {
        // ignora, o \n cuida da quebra de linha
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function csvToObjects(rows) {
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    header.forEach((h, i) => (obj[h] = (r[i] || "").trim()));
    return obj;
  });
}

// extrai o ID do vídeo a partir de várias formas de link do YouTube
function extractYoutubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// extrai o ID de uma playlist do YouTube (links youtube.com/playlist?list=...)
function extractPlaylistId(url) {
  if (!url) return null;
  const m = url.match(/[?&]list=([\w-]+)/);
  return m ? m[1] : null;
}

function groupByCiclo(items) {
  const groups = new Map();
  for (const item of items) {
    const ciclo = item["Ciclo"] || "Sem ciclo";
    if (!groups.has(ciclo)) groups.set(ciclo, new Map());
    const aulas = groups.get(ciclo);
    const aulaKey = `${item["Código"]}__${item["Aula nº"]}__${item["Título da aula"]}`;
    if (!aulas.has(aulaKey)) {
      aulas.set(aulaKey, {
        codigo: item["Código"],
        numero: item["Aula nº"],
        titulo: item["Título da aula"],
        objetivo: item["Objetivo"],
        videos: [],
      });
    }
    aulas.get(aulaKey).videos.push(item);
  }
  return groups;
}

function badge(text, kind) {
  const span = document.createElement("span");
  span.className = `badge badge--${kind}`;
  span.textContent = text;
  return span;
}

function createVideoCard(item) {
  const id = extractYoutubeId(item["Link"]);
  const listId = !id ? extractPlaylistId(item["Link"]) : null;
  const link = (item["Link"] || "").trim();

  const card = document.createElement(link ? "a" : "div");
  card.className = "video-card";
  if (link) {
    card.href = link;
    card.target = "_blank";
    card.rel = "noopener";
  } else {
    card.title = "Link do YouTube não encontrado nesta linha";
    card.classList.add("video-card--disabled");
  }

  if (id) {
    const thumb = document.createElement("img");
    thumb.className = "video-card__thumb";
    thumb.loading = "lazy";
    thumb.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    thumb.alt = item["Título do vídeo"] || "";
    card.appendChild(thumb);
  } else if (listId) {
    const thumb = document.createElement("div");
    thumb.className = "video-card__thumb video-card__thumb--playlist";
    thumb.textContent = "▶ Playlist";
    card.appendChild(thumb);
  }

  const body = document.createElement("div");
  body.className = "video-card__body";

  const title = document.createElement("p");
  title.className = "video-card__title";
  title.textContent = item["Título do vídeo"] || "(sem título)";
  body.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "video-card__meta";
  if (item["Canal / instituição"]) {
    const canal = document.createElement("span");
    canal.textContent = item["Canal / instituição"];
    meta.appendChild(canal);
  }
  body.appendChild(meta);

  const badges = document.createElement("div");
  badges.className = "video-card__badges";
  if (item["Tipo de vídeo"]) {
    badges.appendChild(
      badge(item["Tipo de vídeo"], item["Tipo de vídeo"] === "Principal" ? "primary" : "secondary")
    );
  }
  if (item["Assistido?"] && /sim/i.test(item["Assistido?"])) {
    badges.appendChild(badge("Assistido", "done"));
  }
  body.appendChild(badges);

  card.appendChild(body);
  return card;
}

function createAulaSection(aula) {
  const section = document.createElement("article");
  section.className = "aula";

  const header = document.createElement("header");
  header.className = "aula__header";

  const heading = document.createElement("h3");
  heading.textContent = `Aula ${aula.numero} — ${aula.titulo}`;
  header.appendChild(heading);

  if (aula.objetivo) {
    const objetivo = document.createElement("p");
    objetivo.className = "aula__objetivo";
    objetivo.textContent = aula.objetivo;
    header.appendChild(objetivo);
  }

  section.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "video-grid";
  aula.videos.forEach((v) => grid.appendChild(createVideoCard(v)));
  section.appendChild(grid);

  return section;
}

function renderCicloFilter(cicloNames) {
  const select = document.getElementById("filtro-ciclo");
  cicloNames.forEach((nome) => {
    const opt = document.createElement("option");
    opt.value = nome;
    opt.textContent = nome;
    select.appendChild(opt);
  });
}

function render(items) {
  const content = document.getElementById("content");
  content.innerHTML = "";

  const cicloFiltro = document.getElementById("filtro-ciclo").value;
  const busca = document.getElementById("busca").value.trim().toLowerCase();

  const filtrados = items.filter((item) => {
    if (cicloFiltro && item["Ciclo"] !== cicloFiltro) return false;
    if (!busca) return true;
    const alvo = `${item["Título da aula"]} ${item["Título do vídeo"]} ${item["Canal / instituição"]}`.toLowerCase();
    return alvo.includes(busca);
  });

  if (filtrados.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "empty-state";
    vazio.textContent = "Nenhum vídeo encontrado com esse filtro.";
    content.appendChild(vazio);
    return;
  }

  const groups = groupByCiclo(filtrados);
  for (const [ciclo, aulas] of groups) {
    const section = document.createElement("section");
    section.className = "ciclo";

    const h2 = document.createElement("h2");
    h2.textContent = ciclo;
    section.appendChild(h2);

    for (const aula of aulas.values()) {
      section.appendChild(createAulaSection(aula));
    }
    content.appendChild(section);
  }
}

async function init() {
  const status = document.getElementById("status");
  try {
    const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const rows = parseCSV(text);
    const items = csvToObjects(rows);

    const ciclos = [...new Set(items.map((i) => i["Ciclo"]).filter(Boolean))];
    renderCicloFilter(ciclos);

    status.remove();
    render(items);

    document.getElementById("filtro-ciclo").addEventListener("change", () => render(items));
    document.getElementById("busca").addEventListener("input", () => render(items));
  } catch (err) {
    status.textContent = `Não foi possível carregar a planilha (${err.message}). Verifique se ela continua publicada na web como CSV.`;
    status.classList.add("status--error");
  }
}

init();
