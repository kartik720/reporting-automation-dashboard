// ---- Menu Setup ----
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Reports')
    .addItem('Generate Snapshot', 'generateReportSnapshot')
    .addItem('Export Current View as PDF', 'exportCurrentViewAsPDF')
    .addItem('Check All Clients for Alerts', 'checkAllClientAlerts')
    .addToUi();
}

// ---- Threshold bands, mirrors the dashboard's conditional formatting exactly ----
var THRESHOLD_BANDS = {
  total_followers:   { type: 'binary', red: -0.10 },
  reach_views:        { type: 'binary', red: -0.20 },
  total_engagements:  { type: 'binary', red: -0.20 },
  engagement_rate:    { type: 'tiered', yellow: -0.05, red: -0.15 },
  follower_growth:    { type: 'binary', red: -0.10 },
  primary_outcome:    { type: 'tiered', yellow: -0.05, red: -0.15 }
};

var COLORS = {
  green:  '#b7e1cd',
  yellow: '#fce8b2',
  red:    '#f4c7c3',
  gray:   '#d9d9d9'
};

// ---- Determine the fill color for a given KPI's % change ----
function getFlagColor(kpiKey, pctChange) {
  if (pctChange === 'N/A' || pctChange === null || pctChange === undefined || isNaN(pctChange)) {
    return COLORS.gray;
  }
  var band = THRESHOLD_BANDS[kpiKey];
  if (band.type === 'binary') {
    return pctChange < band.red ? COLORS.red : COLORS.green;
  } else {
    if (pctChange < band.red) return COLORS.red;
    if (pctChange < band.yellow) return COLORS.yellow;
    return COLORS.green;
  }
}

// ---- Single source of truth: read whatever is currently selected on the dashboard ----
function readCurrentSnapshot() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dashboard = ss.getSheetByName('dashboard');

  var clientPretty = dashboard.getRange('B1').getValue();
  var rangeStart     = dashboard.getRange('B3').getValue();
  var rangeEnd         = dashboard.getRange('C3').getValue();

  var kpiValues = {
    total_followers:  dashboard.getRange('B6').getValue(),
    reach_views:        dashboard.getRange('B7').getValue(),
    total_engagements:  dashboard.getRange('B8').getValue(),
    engagement_rate:    dashboard.getRange('B9').getValue(),
    follower_growth:    dashboard.getRange('B10').getValue(),
    primary_outcome:    dashboard.getRange('B11').getValue()
  };

  var kpiPctChange = {
    total_followers:  dashboard.getRange('D6').getValue(),
    reach_views:        dashboard.getRange('D7').getValue(),
    total_engagements:  dashboard.getRange('D8').getValue(),
    engagement_rate:    dashboard.getRange('D9').getValue(),
    follower_growth:    dashboard.getRange('D10').getValue(),
    primary_outcome:    dashboard.getRange('D11').getValue()
  };

  var outcomeLabel = dashboard.getRange('A11').getValue();

  return {
    timestamp: new Date(),
    clientPretty: clientPretty,
    rangeStart: rangeStart,
    rangeEnd: rangeEnd,
    kpiValues: kpiValues,
    kpiPctChange: kpiPctChange,
    outcomeLabel: outcomeLabel
  };
}

// ---- Append a snapshot object as a new row in report_log, return the row index ----
function logSnapshot(snap) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = ss.getSheetByName('report_log');

  if (!logSheet) {
    logSheet = ss.insertSheet('report_log');
    var headers = [
      'Timestamp', 'Client', 'Range Start', 'Range End',
      'Total Followers', 'Followers % Change',
      'Reach/Views', 'Reach % Change',
      'Total Engagements', 'Engagements % Change',
      'Engagement Rate', 'Eng. Rate % Change',
      'Follower Growth', 'Growth % Change',
      'Primary Outcome Label', 'Primary Outcome Count', 'Outcome % Change'
    ];
    logSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    logSheet.setFrozenRows(1);
  }

  var row = [
    snap.timestamp, snap.clientPretty, snap.rangeStart, snap.rangeEnd,
    snap.kpiValues.total_followers, snap.kpiPctChange.total_followers,
    snap.kpiValues.reach_views, snap.kpiPctChange.reach_views,
    snap.kpiValues.total_engagements, snap.kpiPctChange.total_engagements,
    snap.kpiValues.engagement_rate, snap.kpiPctChange.engagement_rate,
    snap.kpiValues.follower_growth, snap.kpiPctChange.follower_growth,
    snap.outcomeLabel, snap.kpiValues.primary_outcome, snap.kpiPctChange.primary_outcome
  ];

  var newRowIndex = logSheet.getLastRow() + 1;
  logSheet.getRange(newRowIndex, 1, 1, row.length).setValues([row]);

  var pctChangeColumns = {
    total_followers: 6, reach_views: 8, total_engagements: 10,
    engagement_rate: 12, follower_growth: 14, primary_outcome: 17
  };

  for (var key in pctChangeColumns) {
    var col = pctChangeColumns[key];
    var color = getFlagColor(key, snap.kpiPctChange[key]);
    logSheet.getRange(newRowIndex, col).setBackground(color);
  }

  [6, 8, 10, 12, 14, 17].forEach(function(col) {
    var cell = logSheet.getRange(newRowIndex, col);
    if (typeof cell.getValue() === 'number') cell.setNumberFormat('0.0%');
  });

  return newRowIndex;
}

// ---- Menu action: log only ----
function generateReportSnapshot() {
  var snap = readCurrentSnapshot();
  logSnapshot(snap);
  SpreadsheetApp.getUi().alert('Report snapshot logged for ' + snap.clientPretty + ' (' +
    Utilities.formatDate(snap.rangeStart, Session.getScriptTimeZone(), 'MMM d, yyyy') + ' – ' +
    Utilities.formatDate(snap.rangeEnd, Session.getScriptTimeZone(), 'MMM d, yyyy') + ')');
}

// ---- KPI display order for the one-pager ----
var KPI_DISPLAY = [
  { key: 'total_followers',   label: 'Total Followers',   isPercent: false },
  { key: 'reach_views',       label: 'Reach / Views',     isPercent: false },
  { key: 'total_engagements', label: 'Total Engagements', isPercent: false },
  { key: 'engagement_rate',   label: 'Engagement Rate',   isPercent: true  },
  { key: 'follower_growth',   label: 'Follower Growth',   isPercent: false },
  { key: 'primary_outcome',   label: null,                isPercent: false }
];

// ---- Menu action: log the current view AND export it as a branded PDF ----
function exportCurrentViewAsPDF() {
  var snap = readCurrentSnapshot();
  logSnapshot(snap); // report_log stays the single record of every export too

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tempName = '_pdf_export_temp';
  var existing = ss.getSheetByName(tempName);
  if (existing) ss.deleteSheet(existing);
  var temp = ss.insertSheet(tempName);

  // ---- Wide, padded columns (content starts at column A now, top-left anchored) ----
  temp.setColumnWidth(1, 260);  // metric label
  temp.setColumnWidth(2, 200);  // value
  temp.setColumnWidth(3, 200);  // % change

  // ---- Header block (starts at column A, row 1 — top-left anchored) ----
  temp.getRange('A1').setValue(snap.clientPretty + ' — Performance Report')
    .setFontSize(22).setFontWeight('bold').setFontColor('#1a1a2e').setHorizontalAlignment('left');
  temp.getRange('A1:C1').merge();

  var periodText = Utilities.formatDate(snap.rangeStart, Session.getScriptTimeZone(), 'MMM d, yyyy') +
    '  –  ' + Utilities.formatDate(snap.rangeEnd, Session.getScriptTimeZone(), 'MMM d, yyyy');
  temp.getRange('A2').setValue(periodText).setFontSize(13).setFontColor('#666666').setHorizontalAlignment('left');
  temp.getRange('A2:C2').merge();

  temp.getRange('A3').setValue('Generated ' + Utilities.formatDate(snap.timestamp, Session.getScriptTimeZone(), 'MMM d, yyyy h:mm a'))
    .setFontSize(9).setFontColor('#999999').setFontStyle('italic').setHorizontalAlignment('left');
  temp.getRange('A3:C3').merge();

  // Divider
  temp.getRange('A4:C4').setBackground('#1a1a2e');
  temp.setRowHeight(4, 3);

  // Extra breathing room between title block and table
  temp.setRowHeight(5, 10);
  temp.setRowHeight(6, 10);

  // ---- Table header ----
  var headerRow = 7;
  temp.getRange(headerRow, 1, 1, 3).setValues([['Metric', 'Value', 'YoY Change']])
    .setFontWeight('bold').setFontColor('#ffffff').setBackground('#1a1a2e')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  temp.setRowHeight(headerRow, 32);

  // ---- KPI rows ----
  var r = headerRow + 1;
  KPI_DISPLAY.forEach(function(kpi) {
    var label = kpi.label || snap.outcomeLabel;
    var value = snap.kpiValues[kpi.key];
    var pct = snap.kpiPctChange[kpi.key];
    var color = getFlagColor(kpi.key, pct);

    var displayValue = kpi.isPercent
      ? (typeof value === 'number' ? (value * 100).toFixed(2) + '%' : value)
      : (typeof value === 'number' ? value.toLocaleString() : value);

    var displayPct = (typeof pct === 'number') ? (pct >= 0 ? '+' : '') + (pct * 100).toFixed(1) + '%' : 'N/A';

    temp.getRange(r, 1).setValue(label).setFontWeight('bold').setFontSize(11)
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    temp.getRange(r, 2).setValue(displayValue).setFontSize(11)
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    temp.getRange(r, 3).setValue(displayPct).setFontSize(11).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground(color);
    temp.setRowHeight(r, 30);
    r++;
  });

  temp.getRange(headerRow, 1, r - headerRow, 3)
    .setBorder(true, true, true, true, true, true, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);

  // ---- Footer ----
  temp.setRowHeight(r, 10);
  temp.getRange(r + 1, 1).setValue('Automated Multi-Platform Client Reporting Dashboard')
    .setFontSize(8).setFontColor('#aaaaaa').setFontStyle('italic').setHorizontalAlignment('left');
  temp.getRange(r + 1, 1, 1, 3).merge();

  temp.setHiddenGridlines(true);

  // ---- Export as PDF, anchored top-left on the page (no page-level centering) ----
  SpreadsheetApp.flush();
  var url = ss.getUrl().replace(/edit$/, '');
  var exportUrl = url + 'export?format=pdf&gid=' + temp.getSheetId() +
    '&size=letter&portrait=true&fitw=true&top_margin=0.5&bottom_margin=0.5' +
    '&left_margin=0.5&right_margin=0.5&gridlines=false&printtitle=false';

  var token = ScriptApp.getOAuthToken();
  var response = UrlFetchApp.fetch(exportUrl, { headers: { Authorization: 'Bearer ' + token } });

  var fileName = snap.clientPretty.replace(/\s+/g, '_') + '_Report_' +
    Utilities.formatDate(snap.rangeEnd, Session.getScriptTimeZone(), 'yyyy-MM-dd') + '.pdf';
  var pdfFile = DriveApp.createFile(response.getBlob().setName(fileName));

  ss.deleteSheet(temp);

  SpreadsheetApp.getUi().alert('PDF exported: ' + fileName + '\n\nSaved to your Drive:\n' + pdfFile.getUrl());
}

// ---- Per-client alert recipient config — replace with real addresses ----
var CLIENT_EMAILS = {
  aesthetician: 'you@email.com',
  chiropractor: 'you@email.com',
  real_estate_agent: 'you@email.com',
  vlogger:      'you@email.com'
};

// Friendly display names, matches the dashboard's pretty-label translation
var CLIENT_PRETTY_NAMES = {
  aesthetician: 'Aesthetician',
  chiropractor: 'Chiropractor',
  real_estate_agent: 'Real Estate Agent',
  vlogger:      'Vlogger'
};

// ---- Find the most recently completed quarter's start/end based on the latest date in master_data ----
function getMostRecentCompletedQuarter(masterData) {
  var maxDate = null;
  for (var i = 1; i < masterData.length; i++) {
    var d = masterData[i][0];
    if (d instanceof Date && (maxDate === null || d > maxDate)) maxDate = d;
  }
  var year = maxDate.getFullYear();
  var month = maxDate.getMonth(); // 0-indexed
  var qStartMonth = Math.floor(month / 3) * 3;
  var qEndMonth = qStartMonth + 2;
  var start = new Date(year, qStartMonth, 1);
  var end = new Date(year, qEndMonth + 1, 0); // last day of quarter
  return { start: start, end: end };
}

// ---- Compute the same 6 KPIs + % change for one client, directly from master_data rows ----
function computeClientQuarterKPIs(masterData, clientKey, qStart, qEnd) {
  var pyStart = new Date(qStart.getFullYear() - 1, qStart.getMonth(), qStart.getDate());
  var pyEnd     = new Date(qEnd.getFullYear() - 1, qEnd.getMonth(), qEnd.getDate());

  var cur = { reach: 0, eng: 0, outcome: 0, followersEnd: null, followersBeforeStart: null };
  var py  = { reach: 0, eng: 0, outcome: 0, followersEnd: null, followersBeforeStart: null };

  var dayBeforeStart = new Date(qStart);
  dayBeforeStart.setDate(dayBeforeStart.getDate() - 1);
  var pyDayBeforeStart = new Date(pyStart);
  pyDayBeforeStart.setDate(pyDayBeforeStart.getDate() - 1);

  for (var i = 1; i < masterData.length; i++) {
    var row = masterData[i];
    var d = row[0], client = row[1];
    if (client !== clientKey || !(d instanceof Date)) continue;

    if (d >= qStart && d <= qEnd) {
      cur.reach += (row[3] || 0);
      cur.eng += (row[4] || 0);
      cur.outcome += (row[7] || 0);
      if (d.getTime() === qEnd.getTime()) cur.followersEnd = row[2];
    }
    if (d.getTime() === dayBeforeStart.getTime()) cur.followersBeforeStart = row[2];

    if (d >= pyStart && d <= pyEnd) {
      py.reach += (row[3] || 0);
      py.eng += (row[4] || 0);
      py.outcome += (row[7] || 0);
      if (d.getTime() === pyEnd.getTime()) py.followersEnd = row[2];
    }
    if (d.getTime() === pyDayBeforeStart.getTime()) py.followersBeforeStart = row[2];
  }

  var curEngRate = cur.reach > 0 ? cur.eng / cur.reach : null;
  var pyEngRate = py.reach > 0 ? py.eng / py.reach : null;
  var curGrowth = (cur.followersEnd !== null && cur.followersBeforeStart !== null) ? cur.followersEnd - cur.followersBeforeStart : null;
  var pyGrowth = (py.followersEnd !== null && py.followersBeforeStart !== null) ? py.followersEnd - py.followersBeforeStart : null;

  function pctChange(curVal, pyVal) {
    if (curVal === null || pyVal === null || pyVal === 0) return 'N/A';
    return (curVal - pyVal) / pyVal;
  }

  return {
    total_followers:   { value: cur.followersEnd, pct: pctChange(cur.followersEnd, py.followersEnd) },
    reach_views:         { value: cur.reach, pct: pctChange(cur.reach, py.reach) },
    total_engagements:   { value: cur.eng, pct: pctChange(cur.eng, py.eng) },
    engagement_rate:     { value: curEngRate, pct: pctChange(curEngRate, pyEngRate) },
    follower_growth:     { value: curGrowth, pct: pctChange(curGrowth, pyGrowth) },
    primary_outcome:     { value: cur.outcome, pct: pctChange(cur.outcome, py.outcome) }
  };
}

// ---- Menu action: check all 4 clients, email only the ones with a red flag ----
function checkAllClientAlerts() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var masterSheet = ss.getSheetByName('master_data');
  var masterData = masterSheet.getDataRange().getValues();

  var quarter = getMostRecentCompletedQuarter(masterData);
  var qLabel = 'Q' + (Math.floor(quarter.start.getMonth() / 3) + 1) + ' ' + quarter.start.getFullYear();

  var clientKeys = Object.keys(CLIENT_EMAILS);
  var alertsSent = [];
  var allClear = [];

  clientKeys.forEach(function(clientKey) {
    var kpis = computeClientQuarterKPIs(masterData, clientKey, quarter.start, quarter.end);

    var redFlags = [];
    Object.keys(kpis).forEach(function(kpiKey) {
      var color = getFlagColor(kpiKey, kpis[kpiKey].pct);
      if (color === COLORS.red) {
        redFlags.push({ key: kpiKey, pct: kpis[kpiKey].pct });
      }
    });

    if (redFlags.length > 0) {
      var prettyName = CLIENT_PRETTY_NAMES[clientKey];
      var body = prettyName + ' — ' + qLabel + ' Alert\n\n' +
        'The following metrics dropped beyond their normal threshold vs. ' + qLabel.replace(/\d{4}/, quarter.start.getFullYear() - 1) + ':\n\n';

      redFlags.forEach(function(f) {
        var label = KPI_DISPLAY.find(function(k) { return k.key === f.key; });
        var displayLabel = (label && label.label) ? label.label : f.key;
        body += '- ' + displayLabel + ': ' + (f.pct * 100).toFixed(1) + '% YoY\n';
      });

      body += '\nReview the full dashboard for details.';

      MailApp.sendEmail(CLIENT_EMAILS[clientKey], prettyName + ' — ' + qLabel + ' Performance Alert', body);
      alertsSent.push(prettyName);
    } else {
      allClear.push(CLIENT_PRETTY_NAMES[clientKey]);
    }
  });

  var summary = 'Checked ' + qLabel + ' for all 4 clients.\n\n';
  summary += alertsSent.length > 0 ? 'Alerts sent for: ' + alertsSent.join(', ') + '\n' : 'No alerts triggered.\n';
  summary += allClear.length > 0 ? 'All clear: ' + allClear.join(', ') : '';

  SpreadsheetApp.getUi().alert(summary);
}

// ---- Auto-prompt for custom date range, auto-clear when switching away ----
function onEdit(e) {
  var sheet = e.source.getActiveSheet();
  if (sheet.getName() !== 'dashboard') return;

  var editedCell = e.range;
  // Adjust 'E1' below if your Data Range dropdown lives in a different cell
  if (editedCell.getA1Notation() !== 'E1') return;

  var newValue = editedCell.getValue();
  var ui = SpreadsheetApp.getUi();

  if (newValue === 'Custom') {
    var startResponse = ui.prompt('Custom Date Range', 'Enter the START date in yyyy-mm-dd format (e.g. 2025-01-31):', ui.ButtonSet.OK_CANCEL);
    if (startResponse.getSelectedButton() !== ui.Button.OK) return;
    var startText = startResponse.getResponseText().trim();

    var endResponse = ui.prompt('Custom Date Range', 'Enter the END date in yyyy-mm-dd format (e.g. 2025-03-31):', ui.ButtonSet.OK_CANCEL);
    if (endResponse.getSelectedButton() !== ui.Button.OK) return;
    var endText = endResponse.getResponseText().trim();

    var dateFormatPattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateFormatPattern.test(startText) || !dateFormatPattern.test(endText)) {
      ui.alert('Dates must be entered as yyyy-mm-dd (e.g. 2025-03-31). Please re-select "Custom" and try again.');
      return;
    }

    var startDate = new Date(startText + 'T00:00:00');
    var endDate = new Date(endText + 'T00:00:00');

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      ui.alert('One or both dates could not be understood. Please re-select "Custom" and try again with a format like 2025-01-01.');
      return;
    }
    if (startDate > endDate) {
      ui.alert('Start date is after end date. Please re-select "Custom" and try again.');
      return;
    }

    // Custom Start value goes in E2, Custom End value goes in G2 (labels sit in D2/F2)
    sheet.getRange('E2').setValue(startDate);
    sheet.getRange('G2').setValue(endDate);

  } else {
    // Any non-Custom selection clears the custom range so stale dates never linger
    sheet.getRange('E2').clearContent();
    sheet.getRange('G2').clearContent();
  }
}
