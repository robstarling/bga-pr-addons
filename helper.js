(function (exports, document) {
  "use strict";

  const log = exports.console.log;

  // cleanup, to make it easily reloadable (stop old timers, etc)
  if (exports.bga_pr_helper) {
    if (exports.bga_pr_helper.cleanup) {
      exports.bga_pr_helper.cleanup();
    }
    delete exports.bga_pr_helper;
  }

  const pr = { state: {} };
  pr.players = gameui.gamedatas.players;
  pr.playerorder = gameui.gamedatas.playerorder;

  // Might be stale; good starting guess.
  pr.state.governor = gameui.gamedatas.governor;

  pr.scrapeGovernor = function() {
    const govEls = document.querySelectorAll("#governor");
    if (govEls.length !== 1) {
      log("PR confused by govEls:", govEls);
      return;
    }
    const govId = govEls[0].parentElement.id.substring("governor_".length);
    return pr.players[govId];
  };

  // Doesn't work well after initial load
  pr.lastPlayerToHavePickedRoleAfter = function(governorId) {
    const n_players = pr.playerorder.length;
    const gov_idx = pr.playerorder.findIndex(id => ""+id === governorId);
    log("PR gov @",gov_idx,pr.playerorder);
    let last_picker;
    let last_pick;
    for (let i = 0; i < n_players; i++) {
      const j = (i + gov_idx) % n_players;
      const id = ""+pr.playerorder[j];
      const name = pr.players[id].name;
      let role_picked;
      for (let k in gameui.gamedatas.roles) {
        const role = gameui.gamedatas.roles[k];
        if (id == role.player_id) {
          role_picked = role.rol_type;
          last_picker = id;
          last_pick = role_picked;
          break;
        }
      }
      log("PR:",i,j,id,name,role_picked);
    }
    return [pr.players[last_picker], last_pick];
  };

  pr.findPlayerByName = function(name) {
    for (let i in pr.players) {
      const player = pr.players[i];
      if (player.name === name) {
        return player;
      }
    }
    log("PR: could not find player", name, pr.players);
  };

  pr.rolePickerFromTitle = function() {
    const titleEls = document.querySelectorAll("#pagemaintitletext");
    if (titleEls.length !== 1) {
      log("PR: confused by titleEls", titleEls);
      return;
    }
    const title = titleEls[0].textContent;
    const suffix = " must select a role";
    if (!title.endsWith(suffix)) {
      log("PR: title not about role-picking:", title);
      return;
    }
    const pickerName = title.slice(0, 0-(suffix.length));
    return pr.findPlayerByName(pickerName);
  };

  pr.markRolePicker = function(rolePickerId, roleName) {
    if (!roleName) {
      roleName = "role?";
    }
    pr.state.picker = rolePickerId;
    const pickerDomId = "bga_pr_helper_role_picker";
    document.querySelectorAll("#" + pickerDomId).forEach(span => {
      span.remove();
    });
    const x = "#player_name_" + rolePickerId;
    document.querySelectorAll(x).forEach(div => {
      let span = document.createElement("span");
      span.id = pickerDomId;
      span.innerText = "[" + roleName + "]";
      div.appendChild(span);
    });
  };

  pr.setup = function() {
    const gov = pr.scrapeGovernor();
    if (!gov) {
      log("PR: confused by lack of governor");
      return;
    }
    pr.state.governor = gov.id;
    let picker = pr.rolePickerFromTitle();
    if (picker) {
      log("PR: title says we're waiting for a pick by", picker);
      pr.markRolePicker(picker.id);
    } else {
      let [picker, role] = pr.lastPlayerToHavePickedRoleAfter(gov.id);
      if (picker) {
        log("PR: pretty sure last pick was by", picker, role);
        pr.markRolePicker(picker.id, role);
      } else {
        log("PR: maybe governor hasn't picked yet", gov);
        pr.markRolePicker(gov.id);
      }
    }
  };

// <!--PNS--><span class="playername"><!--PNS--><span class="playername" style="color:#008000;">SomePlayerName</span><!--PNE--></span><!--PNE--> selected the builder

// <!--PNS--><span class="playername"><!--PNS--><span class="playername" style="color:#ffa500;">AnotherPlayerName</span><!--PNE--></span><!--PNE--> is the new governor

  pr.noticeGovAndPickerChangesFromLog = function(msg) {
    const newGovSuffix = "</span><!--PNE--></span><!--PNE--> is the new governor";
    if (msg.endsWith(newGovSuffix)) {
      log("PR: there's a new governor");
      const unsuffixed = msg.slice(0, 0-(newGovSuffix.length));
      const lastAngle = unsuffixed.lastIndexOf(">");
      if (lastAngle >= 0) {
        const name = unsuffixed.substring(lastAngle + 1);
        const gov = pr.findPlayerByName(name);
        if (gov) {
          log("PR: new governor", gov);
          pr.markRolePicker(gov.id);
        }
      }
    } else {
      const roleSelectedFrag = "</span><!--PNE--></span><!--PNE--> selected the ";
      const roleSelectedFragIdx = msg.indexOf(roleSelectedFrag);
      if (roleSelectedFragIdx >= 0) {
        const roleName = msg.substring(roleSelectedFragIdx + roleSelectedFrag.length);
        const unsuffixed = msg.slice(0, roleSelectedFragIdx);
        const lastAngle = unsuffixed.lastIndexOf(">");
        if (lastAngle >= 0) {
          const name = unsuffixed.substring(lastAngle + 1);
          const picker = pr.findPlayerByName(name);
          if (picker) {
            log("PR: picker", picker);
            pr.markRolePicker(picker.id, roleName);
          }
        }
      }
    }
  };

  pr.old_onNewLog = gameui.onNewLog;

  // on next tick,
  setTimeout(() => {
    pr.setup();

    gameui.onNewLog = function(...args) {
      // chain first.
      pr.old_onNewLog(...args);

      const msg = args[0];
      log("PR log:", msg);
      pr.noticeGovAndPickerChangesFromLog(msg);
      let picker = pr.rolePickerFromTitle();
      if (picker) {
        log("PR: title says we're waiting for a pick by", picker);
        pr.markRolePicker(picker.id);
      };
    };
  }, 0);

  pr.cleanup = function() {
    gameui.onNewLog = pr.old_onNewLog;
  };

  exports.bga_pr_helper = pr;

  log("created bga_pr_helper");
})(window, document);
