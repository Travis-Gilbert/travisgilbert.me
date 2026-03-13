import { useState, useEffect } from "react";

const FL =
    "https://fonts.googleapis.com/css2?family=Vollkorn:ital,wght@0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap";

const ft = {
    fontFamily: "'Vollkorn', Georgia, serif",
    fontKerning: "normal",
};
const fb = {
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontKerning: "normal",
};
const fm = {
    fontFamily: "'JetBrains Mono', monospace",
    fontKerning: "normal",
};

const P = {
    chr: "#1C1C20",
    chrL: "#35353C",
    chrT: "#D8D6DC",
    chrMu: "#88868E",
    chrD: "#58565E",
    bg: "#F4F3F0",
    sf: "#F8F7F4",
    cd: "#FEFEFE",
    i: "#18181B",
    i2: "#48464E",
    i3: "#78767E",
    i4: "#A8A6AE",
    i5: "#D0CED4",
    ln: "#E2E0DC",
    lnF: "#ECEAE6",
    r: "#C4503C",
    rS: "rgba(196,80,60,0.07)",
    rL: "rgba(196,80,60,0.22)",
    tmG: "#6AAA6A",
    tmC: "#5AAABA",
    t: {
        note: { c: "#68666E", l: "NOTE" },
        source: { c: "#1A7A8A", l: "SOURCE" },
        person: { c: "#C4503C", l: "PERSON" },
        place: { c: "#2E8A3E", l: "PLACE" },
        concept: { c: "#7050A0", l: "CONCEPT" },
        quote: { c: "#A08020", l: "QUOTE" },
        hunch: { c: "#C07040", l: "HUNCH" },
        event: { c: "#3858B8", l: "EVENT" },
        script: { c: "#607080", l: "SCRIPT" },
        task: { c: "#B85C28", l: "TASK" },
    },
};

const DATA = [
    {
        id: 1,
        type: "source",
        title: "A Symbolic Analysis of Relay and Switching Circuits",
        body: "Claude Shannon's foundational work.",
        date: "Mar 9",
        edges: 4,
        why: "Entity match: Claude Shannon",
        og: {
            title: "A Symbolic Analysis of Relay and Switching Circuits",
            desc: "Master's thesis, MIT 1937. Boolean algebra for switching circuits.",
            site: "MIT Archives",
            img: true,
        },
        tag: "PDF",
    },
    {
        id: 2,
        type: "concept",
        title: "Stigmergy",
        body: "Indirect coordination through environmental modification.",
        date: "Mar 8",
        edges: 7,
        why: "Topic cluster: emergence",
    },
    {
        id: 3,
        type: "hunch",
        title: "Connection engines are stigmergic systems",
        body: "The connection engine IS a stigmergic medium.",
        date: "Mar 8",
        edges: 3,
        why: "Tension with: Stigmergy",
        pins: [
            { t: "Vannevar Bush", ty: "person" },
            { t: "Memex", ty: "concept" },
        ],
    },
    {
        id: 4,
        type: "person",
        title: "Vannevar Bush",
        body: "'As We May Think' (1945). Grandfather of hypertext.",
        date: "Mar 7",
        edges: 5,
        role: "Researcher",
    },
    {
        id: 5,
        type: "source",
        title: "Information Theory",
        date: "Mar 9",
        edges: 3,
        og: {
            title: "Information theory",
            desc: "Mathematical study of quantification, storage, and communication of information.",
            site: "en.wikipedia.org",
            img: true,
        },
        tag: "WEB",
    },
    {
        id: 6,
        type: "quote",
        title: "The best way to predict the future is to invent it.",
        attr: "Alan Kay, 1971",
        date: "Mar 6",
        edges: 2,
    },
    {
        id: 7,
        type: "place",
        title: "Strasbourg Cathedral",
        body: "Gothic masterwork. 142m spire.",
        date: "Mar 5",
        edges: 3,
    },
    {
        id: 8,
        type: "task",
        title: "Implement seven-pass alignment",
        date: "Mar 8",
        edges: 2,
        due: "Mar 15",
    },
    {
        id: 9,
        type: "event",
        title: "CommonPlace v0.1 milestone",
        body: "Backend complete. Frontend operational.",
        date: "Mar 9",
        edges: 6,
    },
    {
        id: 10,
        type: "script",
        title: "resurface_weighted.py",
        body: [
            "def score(obj, ctx):",
            "  recency = decay(obj.last_touched, 7)",
            "  return weighted_sum(r=0.25)",
        ].join("\n"),
        date: "Mar 7",
        edges: 4,
    },
    {
        id: 11,
        type: "note",
        title: "On walkable software",
        body:
            "Good software has the quality of a walkable city: human scale, discoverable, rewards exploration.",
        date: "Mar 9",
        edges: 1,
    },
    {
        id: 12,
        type: "concept",
        title: "Memex",
        body: "Bush's hypothetical device for cross-referencing all records.",
        date: "Mar 6",
        edges: 6,
        why: "Hub node: 6 connections",
    },
    {
        id: 13,
        type: "hunch",
        title: "Templates as frozen stigmergy",
        body: "Frozen traces of successful coordination patterns.",
        date: "Mar 8",
        edges: 2,
    },
];

const LINEAGE = [
    { t: "Parking lot research", ty: "source", d: "Feb 12" },
    { t: "Induced demand", ty: "hunch", d: "Feb 18" },
    { t: "On walkable software", ty: "note", d: "Mar 2" },
    { t: "5th Ave streetscape", ty: "source", d: "Mar 7" },
    { t: "Urban Systems", ty: "concept", d: "Mar 9" },
];

const CLUSTERS = [
    {
        title: "Information Architecture",
        count: 12,
        summary:
            "Shannon to Memex to stigmergy to CommonPlace. Four sources and two concepts form the theoretical backbone.",
        members: [1, 5, 2, 12],
        growth: "+3 this week",
    },
    {
        title: "Urban Systems as Software",
        count: 8,
        summary:
            "Walkable software bridges urban planning and interface design. Induced demand and feature creep are structurally identical.",
        members: [11, 7],
        growth: "+1 this week",
    },
];

const Mo = ({ children, s = 10, c = P.i3, w = 500, style = {} }) => (
    <span
        style={{
            ...fm,
            fontSize: s,
            fontWeight: w,
            letterSpacing: "0.04em",
            color: c,
            ...style,
        }}
    >
    {children}
  </span>
);

const Dot = ({ color, size = 6, glow }) => (
    <span
        style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: color,
            display: "inline-block",
            flexShrink: 0,
            boxShadow: glow ? `0 0 6px ${color}50` : "none",
        }}
    />
);

const Tag = ({ children, color, filled }) => (
    <span
        style={{
            ...fm,
            fontSize: 9,
            fontWeight: 600,
            color: filled ? "#fff" : color,
            background: filled ? color : `${color}14`,
            padding: "2px 7px",
            borderRadius: 3,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
        }}
    >
    {children}
  </span>
);

const Edges = ({ n, c = P.i4 }) =>
    n > 0 ? (
        <span
            style={{
                ...fm,
                fontSize: 9,
                fontWeight: 500,
                color: c,
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
            }}
        >
      ({n})
    </span>
    ) : null;

const PinBadge = ({ title, type }) => {
    const tc = P.t[type] || P.t.note;
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                borderRadius:
                    type === "person" || type === "concept" ? 100 : 3,
                border:
                    type === "hunch"
                        ? `1px dashed ${tc.c}40`
                        : `1px solid ${tc.c}25`,
                background: `${tc.c}08`,
                ...fb,
                fontSize: 10.5,
                fontWeight: 500,
                color: P.i2,
                fontStyle: type === "hunch" ? "italic" : "normal",
            }}
        >
      {type === "person" && (
          <span
              style={{
                  width: 13,
                  height: 13,
                  borderRadius: "50%",
                  background: `${tc.c}20`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  ...ft,
                  fontSize: 7,
                  fontWeight: 700,
                  color: tc.c,
              }}
          >
          {title[0]}
        </span>
      )}
            {type === "concept" && <Dot color={tc.c} size={4} />}
            <span
                style={{
                    maxWidth: 120,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}
            >
        {title}
      </span>
    </span>
    );
};

const Card = ({ o, onClick }) => {
    const [hover, setHover] = useState(false);
    const tc = P.t[o.type] || P.t.note;
    const og = o.og || {};

    const base = {
        cursor: "pointer",
        transition: "all 140ms",
    };

    const handlers = {
        onMouseEnter: () => setHover(true),
        onMouseLeave: () => setHover(false),
        onClick: () => onClick?.(o),
    };

    if (o.type === "source") {
        return (
            <div
                style={{
                    ...base,
                    display: "flex",
                    flexDirection: "column",
                    background: hover ? `${tc.c}08` : "transparent",
                    border: `1px solid ${hover ? `${tc.c}28` : P.lnF}`,
                    borderRadius: 6,
                    overflow: "hidden",
                }}
                {...handlers}
            >
                {og.img && (
                    <div
                        style={{
                            height: 46,
                            background: `linear-gradient(135deg,${tc.c}08,${tc.c}18)`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0 14px",
                        }}
                    >
                        <Mo
                            s={9}
                            c={tc.c}
                            w={600}
                            style={{ letterSpacing: "0.08em" }}
                        >
                            {(og.site || "").toUpperCase()}
                        </Mo>
                        {o.tag && <Tag color={tc.c}>{o.tag}</Tag>}
                    </div>
                )}
                <div style={{ padding: "11px 14px 12px" }}>
                    <div
                        style={{
                            ...fb,
                            fontSize: 14.5,
                            fontWeight: 600,
                            color: P.i,
                            lineHeight: 1.35,
                        }}
                    >
                        {og.title || o.title}
                    </div>
                    {og.desc && (
                        <div
                            style={{
                                ...fb,
                                fontSize: 12.5,
                                color: P.i2,
                                lineHeight: 1.55,
                                marginTop: 4,
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                            }}
                        >
                            {og.desc}
                        </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 7 }}>
                        <Mo s={9} c={P.i4}>
                            {o.date}
                        </Mo>
                        <Edges n={o.edges} />
                    </div>
                </div>
            </div>
        );
    }

    if (o.type === "person") {
        return (
            <div
                style={{
                    ...base,
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    padding: "9px 15px",
                    borderRadius: 100,
                    border: `1px solid ${
                        hover ? `${tc.c}35` : P.lnF
                    }`,
                    background: hover ? `${tc.c}08` : "transparent",
                }}
                {...handlers}
            >
                <div
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: `linear-gradient(135deg,${tc.c}15,${tc.c}25)`,
                        border: `1.5px solid ${tc.c}40`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}
                >
          <span
              style={{
                  ...ft,
                  fontSize: 14,
                  fontWeight: 700,
                  color: tc.c,
              }}
          >
            {o.title[0]}
          </span>
                </div>
                <div style={{ flex: 1 }}>
                    <div
                        style={{
                            ...fb,
                            fontSize: 14,
                            fontWeight: 600,
                            color: P.i,
                        }}
                    >
                        {o.title}
                    </div>
                    {o.role && (
                        <Mo s={10} c={P.i4}>
                            {o.role}
                        </Mo>
                    )}
                </div>
                <Edges n={o.edges} />
            </div>
        );
    }

    if (o.type === "concept") {
        return (
            <div
                style={{
                    ...base,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "6px 15px",
                    borderRadius: 100,
                    border: `1.5px solid ${
                        hover ? tc.c : `${tc.c}35`
                    }`,
                    background: hover ? `${tc.c}08` : "transparent",
                }}
                {...handlers}
            >
                <Dot color={tc.c} size={7} />
                <span
                    style={{
                        ...fb,
                        fontSize: 13,
                        fontWeight: 500,
                        color: P.i,
                    }}
                >
          {o.title}
        </span>
                <Mo s={9} c={tc.c} w={600}>
                    {o.edges}
                </Mo>
            </div>
        );
    }

    if (o.type === "hunch") {
        return (
            <div
                style={{
                    ...base,
                    padding: "11px 15px",
                    border: `1.5px dashed ${
                        hover ? tc.c : `${tc.c}50`
                    }`,
                    borderRadius: 5,
                    background: hover ? `${tc.c}10` : `${tc.c}06`,
                    transform: "rotate(-0.3deg)",
                }}
                {...handlers}
            >
                <div
                    style={{
                        ...fb,
                        fontSize: 13.5,
                        fontWeight: 500,
                        color: P.i,
                        fontStyle: "italic",
                        lineHeight: 1.45,
                    }}
                >
                    {o.title}
                </div>
                {o.body && (
                    <div
                        style={{
                            ...fb,
                            fontSize: 12,
                            color: P.i3,
                            lineHeight: 1.5,
                            marginTop: 3,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                        }}
                    >
                        {o.body}
                    </div>
                )}
                {o.pins && (
                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 4,
                            marginTop: 6,
                        }}
                    >
                        {o.pins.map((p, i) => (
                            <PinBadge key={i} title={p.t} type={p.ty} />
                        ))}
                    </div>
                )}
                <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                    <Mo s={9} c={tc.c}>
                        {o.date}
                    </Mo>
                    <Edges n={o.edges} c={tc.c} />
                </div>
            </div>
        );
    }

    if (o.type === "quote") {
        return (
            <div
                style={{
                    ...base,
                    padding: "9px 0 9px 16px",
                    borderLeft: `3px solid ${
                        hover ? tc.c : `${tc.c}50`
                    }`,
                    background: hover ? `${tc.c}06` : "transparent",
                }}
                {...handlers}
            >
                <div
                    style={{
                        ...ft,
                        fontSize: 15,
                        fontWeight: 400,
                        fontStyle: "italic",
                        color: P.i,
                        lineHeight: 1.55,
                    }}
                >
                    “{o.title}”
                </div>
                {o.attr && (
                    <Mo
                        s={10}
                        c={tc.c}
                        w={500}
                        style={{ display: "block", marginTop: 4 }}
                    >
                        {o.attr}
                    </Mo>
                )}
            </div>
        );
    }

    if (o.type === "task") {
        return (
            <div
                style={{
                    ...base,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 13px",
                    borderRadius: 4,
                    background: hover ? `${tc.c}08` : "transparent",
                    borderBottom: `1px solid ${P.lnF}`,
                }}
                {...handlers}
            >
                <div
                    style={{
                        width: 15,
                        height: 15,
                        borderRadius: 3,
                        border: `1.5px solid ${tc.c}`,
                        flexShrink: 0,
                    }}
                />
                <span
                    style={{
                        ...fb,
                        fontSize: 13,
                        fontWeight: 500,
                        color: P.i,
                        flex: 1,
                    }}
                >
          {o.title}
        </span>
                {o.due && <Mo s={9} c={P.i4}>{o.due}</Mo>}
            </div>
        );
    }

    if (o.type === "event") {
        const [month, day] = o.date.split(" ");
        return (
            <div
                style={{
                    ...base,
                    display: "flex",
                    gap: 12,
                    padding: "9px 14px",
                    borderLeft: `3px solid ${tc.c}`,
                    borderRadius: "0 5px 5px 0",
                    background: hover ? `${tc.c}06` : "transparent",
                }}
                {...handlers}
            >
                <div
                    style={{
                        ...fm,
                        fontSize: 10,
                        fontWeight: 600,
                        color: tc.c,
                        minWidth: 32,
                        textAlign: "center",
                        lineHeight: 1.4,
                    }}
                >
                    {month}
                    <br />
                    <span
                        style={{ fontSize: 17, fontWeight: 700 }}
                    >
            {day}
          </span>
                </div>
                <div>
                    <div
                        style={{
                            ...fb,
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: P.i,
                        }}
                    >
                        {o.title}
                    </div>
                    {o.body && (
                        <div
                            style={{
                                ...fb,
                                fontSize: 12,
                                color: P.i3,
                                marginTop: 2,
                            }}
                        >
                            {o.body}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (o.type === "script") {
        return (
            <div
                style={{
                    ...base,
                    background: "#1A1C22",
                    border: "1px solid #2A2C32",
                    borderRadius: 5,
                    overflow: "hidden",
                }}
                {...handlers}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 10px",
                        borderBottom: "1px solid #2A2C32",
                        position: "relative",
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            pointerEvents: "none",
                            background:
                                "radial-gradient(ellipse at 0% 100%,rgba(45,95,107,0.07) 0%,transparent 50%)",
                        }}
                    />
                    <Dot color="#6AAA6A" size={6} glow />
                    <Mo s={10} c="#6A7080">
                        {o.title}
                    </Mo>
                </div>
                <div style={{ padding: "8px 11px" }}>
                    {o.body && (
                        <pre
                            style={{
                                ...fm,
                                fontSize: 11,
                                color: "#C0C8D8",
                                lineHeight: 1.65,
                                margin: 0,
                                whiteSpace: "pre-wrap",
                                maxHeight: 90,
                                overflow: "hidden",
                            }}
                        >
              {o.body}
            </pre>
                    )}
                    <div
                        style={{ display: "flex", gap: 8, marginTop: 4 }}
                    >
                        <Mo s={9} c="#6A7080">
                            {o.edges} edges
                        </Mo>
                    </div>
                </div>
            </div>
        );
    }

    if (o.type === "place") {
        return (
            <div
                style={{
                    ...base,
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    padding: "9px 14px",
                    border: `1px solid ${
                        hover ? `${tc.c}30` : P.lnF
                    }`,
                    borderRadius: 6,
                    background: hover ? `${tc.c}06` : "transparent",
                }}
                {...handlers}
            >
                <svg
                    width={14}
                    height={18}
                    viewBox="0 0 16 20"
                    fill="none"
                >
                    <path
                        d="M8 1C4.69 1 2 3.69 2 7c0 4.5 6 12 6 12s6-7.5 6-12c0-3.31-2.69-6-6-6z"
                        fill={`${tc.c}20`}
                        stroke={tc.c}
                        strokeWidth={1.5}
                    />
                    <circle cx={8} cy={7} r={2} fill={tc.c} />
                </svg>
                <div style={{ flex: 1 }}>
                    <div
                        style={{
                            ...fb,
                            fontSize: 13,
                            fontWeight: 500,
                            color: P.i,
                        }}
                    >
                        {o.title}
                    </div>
                    {o.body && (
                        <div
                            style={{
                                ...fb,
                                fontSize: 12,
                                color: P.i3,
                                marginTop: 2,
                                display: "-webkit-box",
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                            }}
                        >
                            {o.body}
                        </div>
                    )}
                </div>
                <Edges n={o.edges} />
            </div>
        );
    }

    // generic note
    return (
        <div
            style={{
                ...base,
                padding: "13px 16px",
                background: hover ? P.cd : "transparent",
                border: `1px solid ${hover ? P.ln : P.lnF}`,
                borderRadius: 6,
            }}
            {...handlers}
        >
            <div
                style={{
                    ...fb,
                    fontSize: 14.5,
                    fontWeight: 500,
                    color: P.i,
                    lineHeight: 1.45,
                }}
            >
                {o.title}
            </div>
            {o.body && (
                <div
                    style={{
                        ...fb,
                        fontSize: 13,
                        color: P.i2,
                        lineHeight: 1.6,
                        marginTop: 4,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                    }}
                >
                    {o.body}
                </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <Mo s={9} c={P.i4}>
                    {o.date}
                </Mo>
                <Edges n={o.edges} />
            </div>
        </div>
    );
};

export default function LibraryHome() {
    const [search, setSearch] = useState("");
    const [typeF, setTypeF] = useState(null);
    const [sel, setSel] = useState(null);

    useEffect(() => {
        if (
            !document.querySelector(
                'link[href*="Vollkorn"]'
            )
        ) {
            const l = document.createElement("link");
            l.href = FL;
            l.rel = "stylesheet";
            document.head.appendChild(l);
        }
    }, []);

    const filtered = DATA.filter((o) => {
        if (typeF && o.type !== typeF) return false;
        if (
            search &&
            !o.title.toLowerCase().includes(search.toLowerCase())
        )
            return false;
        return true;
    });

    const types = [...new Set(DATA.map((o) => o.type))];

    if (sel) {
        const tc = P.t[sel.type] || P.t.note;
        const og = sel.og || {};

        const DetailTabs = () => {
            const [tab, setTab] = useState("Overview");

            const connections = [
                {
                    to: "Memex",
                    ty: "concept",
                    reason: "Both describe associative knowledge systems",
                    eng: "sbert",
                    str: 82,
                },
                {
                    to: "On walkable software",
                    ty: "note",
                    reason: "Shared vocabulary: navigation, discovery",
                    eng: "bm25",
                    str: 64,
                },
                {
                    to: "Vannevar Bush",
                    ty: "person",
                    reason: "Entity mention
