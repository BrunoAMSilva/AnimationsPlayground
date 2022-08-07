let seed = 0;
let brightnessSeed = 0;
let gravity = 0.06;

function getHue() {
  seed += 0.1;
  return noise(seed) * 80 + 290;
}

function seek(vehicle, target) {
    let desired = p5.Vector.sub(target, vehicle);
    desired.setMag(vehicle.maxSpeed);
    let steer = p5.Vector.sub(desired, vehicle.vel);
    steer.limit(vehicle.maxForce);
    return steer;
}

function arrive(vehicle, target) {
    let desired = p5.Vector.sub(target, vehicle);
    let d = desired.mag();
    let speed = vehicle.maxSpeed;
    if (d < 250) {
        speed = map(d, 0, 250, 0, vehicle.maxSpeed);
    }
    desired.setMag(speed);
    let steer = p5.Vector.sub(desired, vehicle.vel);
    steer.limit(vehicle.maxForce);
    return steer;
}

function flee(vehicle, target) {
    let desired = p5.Vector.sub(target, vehicle);
    desired.setMag(vehicle.maxSpeed);
    desired.mult(-1);
    let steer = p5.Vector.sub(desired, vehicle.vel);
    steer.limit(vehicle.maxForce);
    return steer;
}

class Particle extends p5.Vector {
  constructor(x, y, vx = 0, vy = 0) {
    super(x, y);
    this.vel = createVector(vx, vy);
    this.acc = createVector(0, 0);
    this.r = 20;
    this.hue = getHue();
  }

  applyForce(force) {
    this.acc.add(force);
  }

  update() {
    this.vel.add(this.acc);
    this.add(this.vel);
  }

  edges(type) {
    switch (type) {
      case "bounce":
        this.bounceEdges();
        break;
      case "continuous":
        this.continuousEdges();
        break;
    }
  }

  continuousEdges() {
    if (this.x < 0) {
      this.x = windowWidth;
    }
    if (this.x > windowWidth) {
      this.x = 0;
    }
    if (this.y < 0) {
      this.y = windowHeight;
    }
    if (this.y > windowHeight) {
      this.y = 0;
    }
  }

  bounceEdges() {
    if (this.x < 0 || this.x >= width - this.r) {
      this.vel.x *= -1;
      this.x = this.x < 0 ? this.r : width - this.r;
    }
    if (this.y < 0 || this.y >= height - this.r) {
      this.vel.y *= -1;
      this.y = this.y < 0 ? this.r : height - this.r;
    }
  }
}

class LifetimeParticle extends Particle {
  constructor(x, y, lifetime = 300, vx = 0, vy = 0) {
    super(x, y, vx, vy);
    this.lifetime = lifetime;
    this.completed = false;
  }

  update() {
    this.lifetime -= 1;
    if (this.lifetime <= 0) {
      this.completed = true;
    } else {
      super.update();
    }
  }
}

class Firework extends p5.Vector {
  constructor(x, y, vx = 0, vy = 0) {
    super(x, y);
    this.vel = createVector(vx, vy);
    this.acc = createVector(0, gravity);
    this.exploded = false;
    this.fireworks = [];
    this.hue = getHue();
  }

  applyForce(force) {
    this.acc.add(force);
  }

  update() {
    if (!this.exploded) {
      if (this.vel.y >= 0) {
        this.exploded = true;
        for (let i = 0; i < random(40, 80); i++) {
          const x = 16 * pow(sin(i), 3);
          const y = -(
            13 * cos(i) -
            5 * cos(2 * i) -
            2 * cos(3 * i) -
            cos(4 * i)
          );
          const explodingVelocity = createVector(x, y).mult(0.3);
          const newPart = new LifetimeParticle(
            this.x,
            this.y,
            30,
            explodingVelocity.x,
            explodingVelocity.y
          );
          newPart.applyForce(createVector(0, 0.09));
          this.fireworks.push(newPart);
        }
      } else {
        this.vel.add(this.acc);
        this.add(this.vel);
      }
    } else {
      for (let part of this.fireworks) {
        part.update();
      }
      this.fireworks = this.fireworks.filter((p) => !p.completed);
    }
  }

  show() {
    if (this.exploded) {
      for (let part of this.fireworks) {
        stroke(this.hue, 130, 130);
        strokeWeight(4);
        point(part.x, part.y);
      }
    } else {
      stroke(this.hue, 130, 130);
      strokeWeight(8);
      point(this.x, this.y);
    }
  }
}

class Vehicle extends Particle {
    constructor(x, y) {
        super(x, y);
        this.target = createVector(x, y);
        this.targetExploded = createVector(random(-width, width*2), random(-height, height*2))
        this.maxSpeed = 8;
        this.maxForce = 0.5;
        this.exploding = true;
    }

    behaviors() {
        if (frameCount % 2000 === 0) {
            this.exploding = !this.exploding;
        }

        if (!this.exploding) {
            let arriveForce = arrive(this, this.target);
            this.applyForce(arriveForce);
        } else {
            let arriveForce = arrive(this, this.targetExploded);
            this.applyForce(arriveForce);
        }
    }

    update() {
        super.update();
        this.acc.mult(0);
    }
}

let particles = [];
let laraHue;
let font;
let points;

function preload() {
    font = loadFont('fonts/OleoScriptSwashCaps-Regular.ttf');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  laraHue = getHue();

  points = font.textToPoints('6', width - 400, height - 100, 620).map(pt => {
    return new Vehicle(pt.x, pt.y);
  });
}

function draw() {
  colorMode(RGB);
  background(22, 3, 10, 30);
  noStroke();

  colorMode(HSB);
  fill(laraHue, 50, 86);
  textSize(30);
  textStyle(NORMAL);
  text("Parabéns", 274, 125);
  textSize(120);
  textStyle(BOLD);
  noFill();
  strokeWeight(2);
  stroke(laraHue, 50, 86);
  text("Lara", 200, 200);
  strokeWeight(4);
  points.forEach((pt, idx) => {
    pt.behaviors();
    pt.update();
    stroke(laraHue, 50, (noise(brightnessSeed, idx) * 90) + 10);
    point(pt.x, pt.y);
    brightnessSeed += 0.0002
  });
  stroke(255);
  strokeWeight(20);

  let rnd = random();
  if (rnd < 0.1) {
    particles.push(
      new Firework(
        random(0, width),
        random(height - height / 5, height),
        random(-2, 2),
        random(-5, -9)
      )
    );
  }

  for (let particle of particles) {
    particle.update();
    particle.show();
  }

  particles = particles.filter((p) => !p.exploded || p.fireworks.length > 0);
}

