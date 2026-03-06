// index.js (or script.js)

// Import D3 (for a bundler/ESM setup; if using a <script> tag, skip this line)
import * as d3 from "d3";

// Chart configuration
const margin = { top: 20, right: 20, bottom: 35, left: 40 };
const width = 960;
const height = 560;

// Scales (domains will be set after data load)
const x = d3.scaleLog().range([margin.left, width - margin.right]);
const y = d3.scaleLinear().range([height - margin.bottom, margin.top]);
const radius = d3.scaleSqrt().range([0, width / 24]);
const color = d3.scaleOrdinal(d3.schemeCategory10).unknown("black");

// Axes and grid generators
const xAxis = (g) =>
    g
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(width / 80, ","))
        .call((g) => g.select(".domain").remove())
        .call((g) =>
            g
                .append("text")
                .attr("x", width)
                .attr("y", margin.bottom - 4)
                .attr("fill", "currentColor")
                .attr("text-anchor", "end")
                .text("Income per capita (dollars) →")
        );

const yAxis = (g) =>
    g
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y))
        .call((g) => g.select(".domain").remove())
        .call((g) =>
            g
                .append("text")
                .attr("x", -margin.left)
                .attr("y", 10)
                .attr("fill", "currentColor")
                .attr("text-anchor", "start")
                .text("↑ Life expectancy (years)")
        );

const grid = (g) =>
    g
        .attr("stroke", "currentColor")
        .attr("stroke-opacity", 0.1)
        .call((g) =>
            g
                .append("g")
                .selectAll("line")
                .data(x.ticks())
                .join("line")
                .attr("x1", (d) => 0.5 + x(d))
                .attr("x2", (d) => 0.5 + x(d))
                .attr("y1", margin.top)
                .attr("y2", height - margin.bottom)
        )
        .call((g) =>
            g
                .append("g")
                .selectAll("line")
                .data(y.ticks())
                .join("line")
                .attr("y1", (d) => 0.5 + y(d))
                .attr("y2", (d) => 0.5 + y(d))
                .attr("x1", margin.left)
                .attr("x2", width - margin.right)
        );

// Helper for parsing time series: [year, value] → [Date, value]
function parseSeries(series) {
    return series.map(([year, value]) => [
        new Date(Date.UTC(year, 0, 1)),
        value,
    ]);
}

// Bisector on the date component of [date, value] pairs
const bisectDate = d3.bisector(([date]) => date).left;

// Given an array of [date, value] pairs and a target date,
// return the interpolated value at that date.
function valueAt(values, date) {
    const i = bisectDate(values, date, 0, values.length - 1);
    const a = values[i];
    if (i > 0) {
        const b = values[i - 1];
        const t = (date - a[0]) / (b[0] - a[0]);
        return a[1] * (1 - t) + b[1] * t;
    }
    return a[1];
}

// For a given date, derive the snapshot for all nations
function dataAt(data, date) {
    return data.map((d) => ({
        name: d.name,
        region: d.region,
        income: valueAt(d.income, date),
        population: valueAt(d.population, date),
        lifeExpectancy: valueAt(d.lifeExpectancy, date),
    }));
}

// Main function to build the chart and kick off animation
async function createChart(containerSelector = "body") {
    // Load and preprocess data
    const rawData = await d3.json("nations.json");

    const data = rawData.map(
        ({ name, region, income, population, lifeExpectancy }) => ({
            name,
            region,
            income: parseSeries(income),
            population: parseSeries(population),
            lifeExpectancy: parseSeries(lifeExpectancy),
        })
    );

    // Domains for scales
    x.domain([200, 1e5]);
    y.domain([14, 86]);
    radius.domain([0, 5e8]);
    color.domain(data.map((d) => d.region));

    // Compute list of dates to animate over (monthly)
    const interval = d3.utcMonth;
    const dates = interval.range(
        d3.min(data, (d) => {
            return d3.min(
                [d.income[0], d.population[0], d.lifeExpectancy[0]],
                ([date]) => date
            );
        }),
        d3.min(data, (d) => {
            return d3.max(
                [
                    d.income[d.income.length - 1],
                    d.population[d.population.length - 1],
                    d.lifeExpectancy[d.lifeExpectancy.length - 1],
                ],
                ([date]) => date
            );
        })
    );

    // Create SVG
    const svg = d3
        .create("svg")
        .attr("viewBox", [0, 0, width, height])
        .attr("width", width)
        .attr("height", height);

    // Axes and grid
    svg.append("g").call(xAxis);
    svg.append("g").call(yAxis);
    svg.append("g").call(grid);

    // Initial circles (at first date)
    const initialDate = dates[0];
    const initialData = dataAt(data, initialDate);

    const circle = svg
        .append("g")
        .attr("stroke", "black")
        .selectAll("circle")
        .data(initialData, (d) => d.name)
        .join("circle")
        .sort((a, b) => d3.descending(a.population, b.population))
        .attr("cx", (d) => x(d.income))
        .attr("cy", (d) => y(d.lifeExpectancy))
        .attr("r", (d) => radius(d.population))
        .attr("fill", (d) => color(d.region))
        .call((circle) =>
            circle
                .append("title")
                .text((d) => [d.name, d.region].join("\n"))
        );

    // Update function for a given date
    function update(date) {
        const current = dataAt(data, date);

        circle
            .data(current, (d) => d.name)
            .sort((a, b) => d3.descending(a.population, b.population))
            .attr("cx", (d) => x(d.income))
            .attr("cy", (d) => y(d.lifeExpectancy))
            .attr("r", (d) => radius(d.population));
    }

    // Append SVG to container
    const container = document.querySelector(containerSelector);
    container.appendChild(svg.node());

    // Simple autoplay animation over dates
    let i = 0;
    d3.timer((elapsed) => {
        // e.g., advance one month every 200ms
        const index = Math.floor(elapsed / 200);
        if (index >= dates.length) return true; // stop timer
        if (index !== i) {
            i = index;
            update(dates[i]);
        }
    });
}

// Kick it off (assuming there is a <div id="chart"></div> in your HTML)
createChart("#chart");
