const system = server.registerSystem(0, 0);
const axes = ['x', 'y', 'z'];

system.initialize = function() {
  system.registerComponent(
    "recall_stations:recall_coordinates",
    {x: null, y: null, z: null}
  );

  for (let axis of axes) {
    system.executeCommand(
      "/scoreboard objectives add rs:rc_" +
      axis +
      " dummy",
      () => {}
    );
  }
};

system.listenForEvent(
  "minecraft:block_interacted_with",
  eventData => {
    let player = eventData.data.player;
    let block_position = eventData.data.block_position;

    let entityTickingArea = system.getComponent(
      player, "minecraft:tick_world"
    ).data.ticking_area;

    let block = system.getBlock(entityTickingArea, block_position);

    let handContainer = system.getComponent(
      player, "minecraft:hand_container"
    );
    let mainHandItem = handContainer.data[0];

    if (mainHandItem.__identifier__ != "recall_stations:recall_berry") return;
    if (block.__identifier__ == "recall_stations:recall_anchor") {
      updateCoordinates(player, block_position);
      playAnchorSound(player);
      notifyAnchorMark(player);
    }
});

system.listenForEvent(
  "minecraft:entity_use_item", async function(eventData) {
    let entity = eventData.data.entity;

    if (entity.__identifier__ == "minecraft:player") {
      let player = entity;

      let handContainer = system.getComponent(
        player, "minecraft:hand_container"
      );
      let mainHandItem = handContainer.data[0];

      if (mainHandItem.__identifier__ == "recall_stations:recall_berry") {
        await refreshCoordinates(player);

        if (system.hasComponent(player, "recall_stations:recall_coordinates")) {
          teleport(player);
        }
        else denyTeleport(player);
      }
    }
  }
);

function updateCoordinates(player, block_position) {
  if (!system.hasComponent(player, "recall_stations:recall_coordinates")) {
    system.createComponent(player, "recall_stations:recall_coordinates");
  }

  let recallComponent = system.getComponent(
    player, "recall_stations:recall_coordinates"
  );

  for (let axis of axes) {
    recallComponent.data[axis] = block_position[axis];

    system.executeCommand(
      "/scoreboard players set " +
      getPlayerTarget(player) +
      " rs:rc_" +
      axis +
      " " +
      recallComponent.data[axis],
      () => {}
    );
  }

  system.applyComponentChanges(player, recallComponent);
}

async function refreshCoordinates(player) {
  if (!system.hasComponent(
    player, "recall_stations:recall_coordinates"
  )) {
    system.createComponent(
      player, "recall_stations:recall_coordinates"
    );

    let recallComponent = system.getComponent(
      player, "recall_stations:recall_coordinates"
    );

    for (let axis of axes) {
      let commandResultData = await promiseExecuteCommand(
        "/scoreboard players test " +
        getPlayerTarget(player) +
        " rs:rc_" +
        axis +
        " *");

      let statusMessage = commandResultData.data.statusMessage;
      let match = statusMessage.match(/(\d+)/g);

      if (match === null) {
        system.destroyComponent(player, "recall_stations:recall_coordinates");
        return;
      }

      let coordinate = Number(match[0]);
      recallComponent.data[axis] = coordinate;
    }

    system.applyComponentChanges(player, recallComponent);
  }
}

async function teleport(player) {
  let position = system.getComponent(
    player, "minecraft:position"
  );
  let coordinates = system.getComponent(
    player, "recall_stations:recall_coordinates"
  );

  position.data.x = coordinates.data.x + 0.5;
  position.data.y = coordinates.data.y + 1.0;
  position.data.z = coordinates.data.z + 0.5;

  await promiseExecuteCommand(
    "/effect " +
    getPlayerTarget(player) +
    " blindness 2 1 true"
  );

  await system.applyComponentChanges(player, position);

  system.executeCommand(
    "/playsound random.anvil_land " +
    getPlayerTarget(player) +
    " " +
    position.data.x +
    " " +
    position.data.y +
    " " +
    position.data.z +
    " 8.0 0.4",
    () => {}
  );

  system.executeCommand(
    "/particle minecraft:water_evaporation_bucket_emitter " +
    position.data.x +
    " " +
    (position.data.y + 0.5) +
    " " +
    position.data.z,
    () => {}
  );
}

function denyTeleport(player) {
  let position = system.getComponent(player, "minecraft:position");

  position.data.y += 5;
  system.applyComponentChanges(player, position);

  system.executeCommand(
    "/playsound mob.mooshroom.eat " +
    getPlayerTarget(player) +
    " " +
    position.data.x +
    " " +
    position.data.y +
    " " +
    position.data.z +
    " 8.0 1.5",
    () => {}
  );

  system.executeCommand(
    "/effect " +
    getPlayerTarget(player) +
    " blindness 10 1 true",
    () => {}
  );
}

function promiseExecuteCommand(command) {
  return new Promise((resolve, reject) => {
    system.executeCommand(command, commandResultData => {
      resolve(commandResultData);
    });
  });
}

function playAnchorSound(player) {
  let recallComponent = system.getComponent(
    player, "recall_stations:recall_coordinates"
  );

  system.executeCommand(
    "/playsound item.trident.return " +
    getPlayerTarget(player) +
    " " +
    recallComponent.data.x +
    " " +
    recallComponent.data.y +
    " " +
    recallComponent.data.z +
    " 8.0 0.3",
    () => {}
  );

  system.executeCommand(
    "/particle minecraft:lava_particle " +
    recallComponent.data.x +
    " " +
    (recallComponent.data.y + 0.8) +
    " " +
    recallComponent.data.z,
    () => {}
  );
}

function notifyAnchorMark(player) {
  let tellrawObject = {
    rawtext: [
      {
        text: "§9"
      },
      {
        translate: "tile.recall_stations:recall_anchor.bind"
      }
    ]
  }

  system.executeCommand(
    "/titleraw " +
    getPlayerTarget(player) +
    " times 20 30 20",
    () => {}
  );

  system.executeCommand(
    "/titleraw " +
    getPlayerTarget(player) +
    " title " +
    JSON.stringify(tellrawObject),
    () => {}
  );
}

function getPlayerTarget(player) {
  let position = system.getComponent(player, "minecraft:position");

  return "@p[x=" +
  position.data.x +
  ",y=" +
  position.data.y +
  ",z=" +
  position.data.z +
  "]";
}
