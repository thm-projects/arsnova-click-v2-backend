import * as D3Node from 'd3-node';
import * as d3 from 'd3';

export class HistogramBarChart {

  public static renderSVG(data): string {
    const styles = `.bar rect { fill: black; } .bar text { fill: #fff; font: 10px sans-serif; }`;

    const options = {
      styles: styles,
      d3Module: d3
    };

    const d3n = new D3Node(options);

    const margin = {top: 10, right: 30, bottom: 30, left: 30};
    const width = 960 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;
    const svgWidth = width + margin.left + margin.right;
    const svgHeight = height + margin.top + margin.bottom;

    const x = d3.scaleBand().range([0, width]).padding(0.4);
    const y = d3.scaleLinear().range([height, 0]);

    x.domain(data.map(function (d): string {
      return d.key;
    }));

    y.domain([0, d3.max(data, function (d): number {
      return d.val;
    })]);

    const svg = d3n.createSVG()
      .attr('viewBox', '0, 0, ' + svgWidth + ', ' + svgHeight)
      .append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    svg.append('g')
      .attr('transform', 'translate(0,' + height + ')')
      .call(d3.axisBottom(x));

    svg.append('g')
      .call(d3.axisLeft(y).tickFormat(function(d): string {
        return d;
      }));

    const bar = svg.selectAll('.bar')
      .data(data)
      .enter().append('g')
      .attr('class', 'bar')
      .attr('transform', function (d): string { return 'translate(0,' + y(d.val) + ')'; });

    bar.append('rect')
      .attr('x', function(d): number { return x(d.key); })
      // .attr('y', function(d): number { return y(d.val); })
      .attr('width', x.bandwidth())
      .attr('height', function(d): number { return height - y(d.val); });

    bar.append('text')
      .attr('dy', '.75em')
      .attr('y', function(d): number { return height - y(d.val) < 25 ? -15 : 6; })
      .attr('x', (function(d): number { return x(d.key) + x.bandwidth() / 2; }))
      .attr('text-anchor', 'middle')
      .text(function (d): string { return d.val > 0 ? d.val : ''; });


    return d3n.svgString();
  }
}