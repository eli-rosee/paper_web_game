let game = null;
let count = 1;
let avatar_name;

const userid = String(Math.floor(Math.random() * 10000000));
let last_update_time = new Date();

const parseISOString = (s) => {
	let b = s.split(/\D+/);
	return new Date(Date.UTC(b[0], --b[1], b[2], b[3], b[4], b[5], b[6]));
}

const MapItemTypes = [
	"shredder"
];

const middleX = 500;
const middleY = 250;
const cameraOffsetY = 30;

// Represents a moving image
class Sprite {
	sprite_camera_x = 0;
	sprite_camera_y = 0;

	constructor(x, y, width, height, image_url, id, name) {
		this.x = x;
		this.y = y;
        this.speed = 120; // pixels-per-second
		this.image = new Image();
		this.image.src = image_url;
		this.id = id;
		this.name = name;
		this.width = width;
		this.height = height;

        // Set some default event handlers
		this.update = Sprite.prototype.update_stop;
		this.onleftclick = Sprite.prototype.onclick_ignore;
        this.onrightclick = Sprite.prototype.onclick_ignore;
        this.arrive = Sprite.prototype.update_stop;

	}

	get_bounds() 
	{
		return {
			left: this.x - this.width / 2,
			right: this.x + this.width / 2,
			top: this.y - this.height,
			bottom: this.y,
		};
	}

    // The default update behavior
	update_stop(elapsed_time) {
        delete this.dist_remaining; // causes the object to stop having the property
	}

    // Move forward
	update_travel(elapsed_time) {
		this.travelling = true;
		if(this.dist_remaining === undefined)
			return; // No destination to travel toward
        let dist_step = Math.min(this.dist_remaining, elapsed_time * this.speed);
        this.x += dist_step * this.component_x;
        this.y += dist_step * this.component_y;
        this.dist_remaining = this.dist_remaining - dist_step;
        if (this.dist_remaining === 0)
		{
			this.arrive();
		}

		const does_collide = (a, b) => {
			if (a.right >= b.left && a.left <= b.right && a.bottom >= b.top && a.top <= b.bottom) {
				return true;
			}
			return false;
		};

		let sprite_list = game.model.sprites.slice();
		let thisIndex = sprite_list.indexOf(this);
		if (thisIndex === -1) return;

		let scissor_bounds = this.get_bounds();
		let to_remove = [];

		for (let j = sprite_list.length - 1; j >= 0; j--)
		{
			if (j === thisIndex) continue;

			if(sprite_list[j].id !== userid)
			{
				let ob_bounds = sprite_list[j].get_bounds();
				if(does_collide(scissor_bounds, ob_bounds) && !sprite_list[j].image.src.includes("img/dead_paper.png"))
				{
					if(sprite_list[j].image.src.includes("img/paper.png"))
					{
						to_remove.push(sprite_list[j]);
					}
				}
			}
			else if(sprite_list[j].id === userid && this.image.src.includes("img/scissors.png") && this.owner !== userid && this.owner !== undefined)
			{
				let ob_bounds = sprite_list[j].get_bounds();
				if(does_collide(scissor_bounds, ob_bounds))
				{
					// Only die once
					if (game.isDead) return;

					try {
						game.isDead = true;

						// Swap avatar to dead image and disable interactions
						game.model.avatar.image.src = "img/dead_paper.png";
						game.model.avatar.update = Sprite.prototype.update_stop;
						game.model.avatar.onleftclick = Sprite.prototype.onclick_ignore;
						game.model.avatar.onrightclick = Sprite.prototype.onclick_ignore;

						// Notify server so other players see dead_paper.png
						const packet = {
							action: "Dead",
							id: userid,
							name: game.model.avatar.name,
							time: (new Date()).toISOString(),
							mouse: { x: game.model.avatar.x, y: game.model.avatar.y },
							paperCoords: { x: game.model.avatar.x, y: game.model.avatar.y }
						};
						game.controller.updateServer(packet);
					}
					catch(e) {
        				console.error("Error during death handling: " + e);
					}
				}
			}
		}

		for (let sprite of to_remove)
		{
			let idx = game.model.sprites.indexOf(sprite);
			if (idx !== -1) game.model.sprites.splice(idx, 1);
		}
	}

    // Remove "this" from the list of sprites
    update_disappear(elapsed_time) {
		let index = game.model.sprites.indexOf(this);
		if (index !== -1) game.model.sprites.splice(index, 1); // remove this sprite from the list
    }

    // Do nothing
	onclick_ignore(x, y) {
	}

    // Start travelling to the spot clicked
	onclick_set_destination(worldX, worldY) {
		let delta_x = worldX - this.x;
		let delta_y = worldY - this.y;
		this.dist_remaining = Math.sqrt(delta_x * delta_x + delta_y * delta_y);
		this.component_x = delta_x / this.dist_remaining;
		this.component_y = delta_y / this.dist_remaining;
	}

    // Throw a scissors toward the spot clicked
    onclick_throw_scissors(worldX, worldY) {
		let gen_id = String(Math.floor(Math.random() * 10000000));
		let scissors = new Sprite(this.x, this.y, 25, 25, "img/scissors.png", gen_id);
		scissors.owner = userid;
        scissors.speed = 300; // pixels-per-second
        scissors.update = Sprite.prototype.update_travel;
        scissors.arrive = Sprite.prototype.update_disappear;
		scissors.id = gen_id;
        let delta_x = worldX - this.x;
        let delta_y = worldY - this.y;
        scissors.dist_remaining = Math.sqrt(delta_x * delta_x + delta_y * delta_y);
        scissors.component_x = delta_x / scissors.dist_remaining;
        scissors.component_y = delta_y / scissors.dist_remaining;
		game.model.sprites.push(scissors);
    }

	current_camera_view(x, y) {
		sprite_camera_x = x;
		sprite_camera_y = y;
	}
}



class Model {
	constructor(name) {
		this.sprites = [];

        // Make the avatar
		this.avatar = new Sprite(middleX, middleY, 45, 60, "img/paper.png", userid);
		this.avatar.name = name;
        this.avatar.update = Sprite.prototype.update_travel;
        this.avatar.onleftclick = Sprite.prototype.onclick_set_destination;
        this.avatar.onrightclick = Sprite.prototype.onclick_throw_scissors;
		this.avatar.id = userid;
		this.sprites.push(this.avatar);

        this.last_update_time = new Date();
	}

	update() {
        let now = new Date();
        let elapsed_time = (now - this.last_update_time) / 1000; // seconds
        
        // Update all the sprites
		let sprites_snapshot = this.sprites.slice();
		for (const sprite of sprites_snapshot) {
			sprite.update(elapsed_time);
		}

        this.last_update_time = now;
	}

	onleftclick(worldX, worldY) {
		this.avatar.onleftclick(worldX, worldY);
	}

    onrightclick(worldX, worldY) {
		this.avatar.onrightclick(worldX, worldY);
    }

}




class View
{
	constructor(model) {
		this.model = model;
		this.canvas = document.getElementById("myCanvas");
		this.x_scroll = 0;
		this.y_scroll = 0;
		this.camera_x = 0;
		this.camera_y = 0;
	}

	update() {

        // Clear the screen
		let ctx = this.canvas.getContext("2d");
		ctx.clearRect(0, 0, 1000, 500);
		ctx.font = "20px trebuchet ms";
		ctx.textAlign = "center";

		// Sort the sprites by their y-value, but prioritize those with sprite.name
		this.model.sprites.sort((a, b) => {
			if (a.name && b.name) 
			{
				return a.y - b.y;
			} else if (a.name) 
			{
				return 1;
			} else if (b.name) 
			{
				return -1;
			} else 
			{
				return a.y - b.y;
			}
		});

		this.camera_x = this.model.avatar.x - this.canvas.width / 2;
		this.camera_y = this.model.avatar.y - this.canvas.height / 2 - cameraOffsetY;

        // Draw all the sprites
		for (const sprite of this.model.sprites) 
		{
			ctx.drawImage(sprite.image, sprite.x - sprite.width / 2 - this.camera_x, sprite.y - sprite.height - this.camera_y, sprite.width, sprite.height);

			// Draws name above avatar
			if(sprite.name)
			{
				ctx.fillStyle = "black";
				ctx.fillText(sprite.name, sprite.x - this.camera_x, sprite.y - sprite.height - this.camera_y - 5, sprite.width);
			}
		}

		if (game.isDead) {
			ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
			ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
			ctx.fillStyle = "red";
			ctx.font = "bold 72px trebuchet ms";
			ctx.textAlign = "center";
			ctx.fillText("You Died", this.canvas.width / 2, this.canvas.height / 2);
		}
	}
}




class Controller
{
	static clickBound = false;
	constructor(model, view) {
		this.model = model;
		this.view = view;
		let self = this;

        // Add event listeners
		if (!Controller.clickBound) {
			view.canvas.addEventListener("click", function(event) { self.onLeftClick(event); return false; });
			view.canvas.addEventListener("contextmenu", function(event) { self.onRightClick(event); return false; });
			Controller.clickBound = true; // Prevent rebinding
		}

		this.scissors = {};
        this.paper = {};
        this.board = { paper: this.paper, scissors: this.scissors };

		this.map_items = [];
		this.x_scroll = 0;
		this.y_scroll = 0;

		this.getMap();
	}

	async processMap(map) 
	{
		// console.log("MAP ACQUIRED: " + JSON.stringify(map));
	
		this.x_scroll = map.x_scroll;
		this.y_scroll = map.y_scroll;
		this.view.x_scroll = map.x_scroll;
		this.view.y_scroll = map.y_scroll;
	
		let items = map.items;
		if (!items) return;

		for (let sprite of items) {
			let gen_id = String(Math.floor(Math.random() * 10000000));
			// console.log("Processing sprite: " + JSON.stringify(sprite));
			let newSprite = new Sprite(sprite.x, sprite.y, 125, 75, "img/" + MapItemTypes[sprite.type] + ".png", gen_id);
			// console.log("NEW SPRITE: " + newSprite);
			this.map_items.push(newSprite);
			this.model.sprites.push(newSprite);
		}
	}
	

	onLeftClick(event) {
        event.preventDefault(); 
		const x = event.pageX - this.view.canvas.offsetLeft;
		const y = event.pageY - this.view.canvas.offsetTop;
		
		// Convert screen coordinates to world coordinates
		const worldX = x + this.view.camera_x;
		const worldY = y + this.view.camera_y;
		
		this.model.onleftclick(worldX, worldY);

		console.log("WORLD CLICK X: " + worldX);
		console.log("WORLD CLICK Y: " + worldY);

        // todo: tell the server about this click
		const action = "Click";
		const name = this.model.avatar.name;
		const time = (new Date()).toISOString();

		const mouse = { x: worldX, y: worldY };
		const paperCoords = { x: this.model.avatar.x, y: this.model.avatar.y };

		const packet = { action: action, id: userid, name: name, time: time, mouse: mouse, paperCoords: paperCoords };
		// console.log("Sending packet: " + JSON.stringify(packet));

		this.paper[userid] = packet;
		this.updateServer(packet);
	}

    onRightClick(event) {
        event.preventDefault(); // Suppress the context menu
		if (game.isDead) 
			return;
		const x = event.pageX - this.view.canvas.offsetLeft;
		const y = event.pageY - this.view.canvas.offsetTop;
		
        // todo: tell the server about this click
		const worldX = x + this.view.camera_x;
		const worldY = y + this.view.camera_y;
		
		this.model.onrightclick(worldX, worldY);

		let sprite = this.model.sprites[this.model.sprites.length - 1];

		const action = "Scissors";
		const time = (new Date()).toISOString();
		const scissorCoords = { x: sprite.x, y: sprite.y };
		const mouse = { x: worldX, y: worldY };

		const packet = { action: action, id: sprite.id, userid: userid, time: time, mouse: mouse, scissorCoords: scissorCoords, owner: userid };
		// console.log("Sending scissors packet: " + JSON.stringify(packet));
		
		this.scissors[sprite.id] = packet;
		this.updateServer(packet);
    }

	async getMap() {
		try {
			const response = await fetch('ajax', {
				body: JSON.stringify({action: "Map", id: userid}),
				cache: "no-cache",
				headers: {
					'Content-Type': 'application/json',
				},
				method: "POST",
			});
	
			const text = await response.text();
			// console.log(`Map Fetch: The server replied: ${text}`);
	
			let response_ob = JSON.parse(text);
			this.processMap(response_ob);
		} catch (ex) {
			console.log(`An error occurred: ${ex}\n${ex.stack}`);
		}
	}
	
	process(payload)
	{
		const newPapers = payload.paper;
		const newScissorses = payload.scissors;

		if(newPapers) {
			for(const pap of newPapers)
			{
				if (pap.action === "Dead") {
					this.paper[pap.id] = pap;
					let paperSprite = this.model.sprites.find(s => s.id === pap.id);
					if (paperSprite) {
						paperSprite.image.src = "img/dead_paper.png";
						paperSprite.update = Sprite.prototype.update_stop;
						paperSprite.onleftclick = Sprite.prototype.onclick_ignore;
						paperSprite.onrightclick = Sprite.prototype.onclick_ignore;
					} else {
						let deadSprite = new Sprite(pap.paperCoords.x, pap.paperCoords.y, 45, 60, "img/dead_paper.png", pap.id, pap.name);
						deadSprite.update = Sprite.prototype.update_stop;
						deadSprite.onleftclick = Sprite.prototype.onclick_ignore;
						deadSprite.onrightclick = Sprite.prototype.onclick_ignore;
						this.model.sprites.push(deadSprite);
					}
				}
				else if (!(pap.id in this.paper))
				{
					// new player joined
					
					if (pap.action === "Dead") {
						this.paper[pap.id] = pap;
						let deadSprite = new Sprite(pap.paperCoords.x, pap.paperCoords.y, 45, 60, "img/dead_paper.png", pap.id, pap.name);
						deadSprite.update = Sprite.prototype.update_stop;
						deadSprite.onleftclick = Sprite.prototype.onclick_ignore;
						deadSprite.onrightclick = Sprite.prototype.onclick_ignore;
						this.model.sprites.push(deadSprite);
						continue;
					}

					let newPaper = pap;
					this.paper[pap.id] = newPaper;

					console.log("NEW PLAYER - Target X: " + newPaper.mouse.x);
					console.log("NEW PLAYER - Target Y: " + newPaper.mouse.y);
								
					let newPaperSprite = new Sprite(newPaper.paperCoords.x, newPaper.paperCoords.y, 45, 60, "img/paper.png", newPaper.id, newPaper.name);
					newPaperSprite.id = pap.id;
					newPaperSprite.name = newPaper.name;
			
					newPaperSprite.update = Sprite.prototype.update_travel;
					newPaperSprite.onleftclick = Sprite.prototype.onclick_set_destination;
					newPaperSprite.onrightclick = Sprite.prototype.onclick_throw_scissors;

					this.model.sprites.push(newPaperSprite);
					
					if (newPaper.paperCoords.x != newPaper.mouse.x || newPaper.paperCoords.y != newPaper.mouse.y)
					{
						newPaperSprite.onleftclick(newPaper.mouse.x, newPaper.mouse.y);
					}

					let now = new Date();
					let difftime = (now - parseISOString(newPaper.time))/1000;
					newPaperSprite.update(difftime);
					this.model.last_update_time = now;	
				}
				else if(pap.id !== userid)
				{
					// Update existing player
					let paperSprite;
					let newPaper = pap;
					this.paper[pap.id] = newPaper;

					console.log("UPDATE PLAYER - Target X: " + newPaper.mouse.x);
					console.log("UPDATE PLAYER - Target Y: " + newPaper.mouse.y);

					for (let i = 0; i < this.model.sprites.length; i++) 
					{
						if (this.model.sprites[i].id === pap.id) 
						{
							paperSprite = this.model.sprites[i];
							break;
						}
					}

					if (!paperSprite) 
					{
						paperSprite = new Sprite(newPaper.paperCoords.x, newPaper.paperCoords.y, 45, 60, "img/paper.png", pap.id, pap.name);
						paperSprite.update = Sprite.prototype.update_travel;
						paperSprite.onleftclick = Sprite.prototype.onclick_set_destination;
						paperSprite.onrightclick = Sprite.prototype.onclick_throw_scissors;
						this.model.sprites.push(paperSprite);
					}

					paperSprite.x = newPaper.paperCoords.x;
					paperSprite.y = newPaper.paperCoords.y;
					
					paperSprite.onleftclick(newPaper.mouse.x, newPaper.mouse.y);

					let now = new Date();
					let difftime = (now - parseISOString(newPaper.time))/1000;

					paperSprite.update(difftime);
					this.model.last_update_time = now;
				}
			}
		}

		if(newScissorses) {
			for(const scissorId of Object.keys(newScissorses))
			{
				const scissData = newScissorses[scissorId];
				
				if(!(scissorId in this.scissors))
				{
					// New scissors
					this.scissors[scissorId] = scissData;

					console.log("New scissors Added: " + JSON.stringify(scissData));

					let newScissorsSprite = new Sprite(scissData.scissorCoords.x, scissData.scissorCoords.y, 25, 25, "img/scissors.png", scissData.id);

					newScissorsSprite.owner = scissData.userid || scissData.owner || null;
					newScissorsSprite.speed = 300;
					newScissorsSprite.update = Sprite.prototype.update_travel;
					newScissorsSprite.arrive = Sprite.prototype.update_disappear;
					newScissorsSprite.id = String(scissData.id);

					let delta_x = scissData.mouse.x - scissData.scissorCoords.x;
					let delta_y = scissData.mouse.y - scissData.scissorCoords.y;

					if(delta_x !== 0 || delta_y !== 0)
					{
						newScissorsSprite.dist_remaining = Math.sqrt(delta_x * delta_x + delta_y * delta_y);
						newScissorsSprite.component_x = delta_x / newScissorsSprite.dist_remaining;
						newScissorsSprite.component_y = delta_y / newScissorsSprite.dist_remaining;
					}

					game.model.sprites.push(newScissorsSprite);

					// Fast-forward to account for network delay
					let now = new Date();
					let difftime = (now - parseISOString(scissData.time)) / 1000;
					newScissorsSprite.update_travel(difftime);

					this.model.last_update_time = now;
				}
			}
		}
	}
	

	async updateServer(packet) {
		try {
			await fetch('ajax', {
				body: JSON.stringify(packet),
				cache: "no-cache",
				headers: {
					'Content-Type': 'application/json',
				},
				method: "POST",
			});
		} catch (ex) {
			console.log(`An error occurred: ${ex}\n${ex.stack}`);
		}
	}	

	async serverUpdate() {
		try {
			const response = await fetch('ajax', {
				body: JSON.stringify({action: "update", id: userid }),
				cache: "no-cache",
				headers: {
					'Content-Type': 'application/json',
				},
				method: "POST",
			});
	
			const text = await response.text();
			let response_ob = JSON.parse(text);
			this.process(response_ob);
		} catch (ex) {
			console.log(`An error occurred: ${ex}\n${ex.stack}`);
		}
	}
	

	async update() {
		// Ensure we do not hammer the server with too many update requests
		let now = new Date();
		if (now - last_update_time > 500) { // milliseconds
			last_update_time = now;
	
			// Request updates from the server
			await this.serverUpdate();
		}
	}	
}




class Game {
	constructor(name) {
		this.model = new Model(name);
		this.view = new View(this.model);
		this.controller = new Controller(this.model, this.view);
	}

	onTimer() {
		this.controller.update();
		this.model.update();
		this.view.update();
	}
}




function startGame(name) {
	avatar_name = name;
    game = new Game(name);
    let timer = setInterval(() => { game.onTimer(); }, 30);
}