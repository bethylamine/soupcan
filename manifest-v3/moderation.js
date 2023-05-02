var browser = browser || chrome;

browser.storage.local.get(["state"], v => {

  if (v.state) {
    handleFetch("https://api.beth.lgbt/moderation/reports?state=" + v.state, response => {
      buildTable(response["json"]);
    });
  }
});

function buildTable(reports) {
  document.getElementById("reports-table").innerHTML = `
      <table class="table">
      <thead>
        <tr>
          <th scope="col">Reported user</th>
          <th scope="col">Reports</th>
        </tr>
      </thead>
      <tbody id="reports-table-body">
      </tbody>
    </table>`;
  var grouped_reports = {};

  reports.forEach(report => {
    var screenName = report["transphobe_screen_name"];
    if (!grouped_reports[screenName]) {
      grouped_reports[screenName] = []
    }
    // Check for duplicate reporter
    var duplicateReporter = false;
    grouped_reports[screenName].forEach(gr => {
      if (gr.reporter_id == report.reporter_id) {
        duplicateReporter = true;
      }
    });

    if (!duplicateReporter) {
      grouped_reports[screenName].push(report);
      grouped_reports[screenName] = grouped_reports[screenName].sort((a, b) => {
        return a.report_time - b.report_time;
      });
    }
  });

  var report_screen_names = Object.keys(grouped_reports);
  report_screen_names = report_screen_names.sort((a, b) => {
    var length = grouped_reports[b].length - grouped_reports[a].length;
    if (length != 0) {
      return length;
    }
    var reportTime = grouped_reports[a][0].report_time - grouped_reports[b][0].report_time
    return reportTime;
  });

  var tableBody = document.getElementById("reports-table-body");
  report_screen_names.forEach(screenName => {
    var row = document.createElement("tr");
    var screenNameCell = document.createElement("td");
    screenNameCell.innerHTML = "<a target='_blank' href='https://twitter.com/" + screenName + "'>@" + screenName + "</a>";
    row.appendChild(screenNameCell);
    var reportsCell = document.createElement("td");
    const reports = grouped_reports[screenName];
    var listTag = document.createElement("ol");
    reports.forEach(report => {
      var listEl = document.createElement("li");
      if (report.reporter_screen_name == "(not recorded)") {
        report.reporter_screen_name = "Twitter user " + report.reporter_id;
      }
      listEl.innerHTML = "from " + report.reporter_screen_name + " at " + new Date(report.report_time * 1000).toString().replace(/\(.*/g, "");
      report["user_reason"] = "hello world, this is a great reason";
      if (report["user_reason"]) {
        var preEl = document.createElement("pre");
        preEl.innerText = report["user_reason"];
        listEl.innerHTML += "<br/><b>Reasoning:</b>" + preEl.outerHTML;
      }
      listTag.appendChild(listEl);
    });
    reportsCell.appendChild(listTag);
    row.appendChild(reportsCell);

    tableBody.appendChild(row);
  });
}

const handleFetch = async (url, sendResponse) => {
  const response = await fetch(url);
  var json = "";
  try {
    json = await response.clone().json();
  } catch (error) {

  }
  const text = await response.text();
  sendResponse({"text": text, "json": json});
};