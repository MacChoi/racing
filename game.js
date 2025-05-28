class RacingGame {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.roadSegments = [];
        this.environmentElements = [];
        this.otherCars = []; // 다른 차량 배열
        this.isGameStarted = false;
        this.speed = 0;
        this.maxSpeed = 1.0;
        this.acceleration = 0.01;
        this.deceleration = 0.005;
        this.rotationSpeed = 0.03;
        this.roadLength = 100; // 도로 세그먼트 길이
        this.roadWidth = 10;   // 도로 너비
        this.segmentCount = 10; // 동시에 유지할 도로 세그먼트 수를 5에서 10으로 증가
        this.lastSegmentZ = 0; // 마지막 도로 세그먼트의 Z 위치
        this.curveProbability = 0.0; // 곡선 도로 생성 확률 (일단 0으로 설정)
        this.collisionDetected = false; // 충돌 감지 플래그
        
        // Audio
        this.audioListener = null;
        this.engineOscillator = null; // Oscillator for engine sound
        this.gainNode = null; // Gain node for volume control
        
        this.init();
        this.setupLights();
        this.createInitialRoad();
        this.createGround(); // 땅 생성
        this.car = this.createCar();
        this.scene.add(this.car); // Add the car to the scene
        this.createClouds(); // 구름 생성
        this.setupAudio(); // 오디오 설정
        this.setupEventListeners();
        this.animate();
    }

    init() {
        // Renderer setup
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87CEEB); // Sky blue background
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        // Add Fog for distance effect
        this.scene.fog = new THREE.Fog(0xA3C1AD, 100, 700); // 연한 녹회색 안개 색상, 안개 시작/끝 거리 조정

        // Camera setup
        this.camera.position.set(0, 5, 10);
        this.camera.lookAt(0, 0, 0);

        // Audio Listener
        this.audioListener = new THREE.AudioListener();
        this.camera.add(this.audioListener);
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Increase ambient light intensity
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2); // Increase directional light intensity
        directionalLight.position.set(5, 10, 5);
        this.scene.add(directionalLight);
    }

    createGround() {
        const groundGeometry = new THREE.PlaneGeometry(2000, 20000); // 넓은 땅과 깊이
        const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x6B8E23 }); // 약간 어두운 녹색 (풀)
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.1; // 도로보다 약간 아래에 배치
        this.scene.add(ground);
        // Ground does not need to be in environmentElements for removal logic if it's large and static
        // this.environmentElements.push(ground); // 환경 요소로 관리
    }

    createRoadSegment(zPosition, isCurved = false) {
        const roadGeometry = new THREE.PlaneGeometry(this.roadWidth, this.roadLength);
        const roadMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x555555, // 도로 색상 약간 밝게
            side: THREE.DoubleSide
        });
        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.rotation.x = -Math.PI / 2;
        road.position.z = zPosition;

        // 곡선 처리는 복잡하여 현재는 단순 회전만 적용. 부드러운 곡선은 추가 개발 필요.
        // if (isCurved) {
        //     road.rotation.z = Math.PI / 12; // 곡선 각도 감소
        // }

        this.scene.add(road);
        this.addRoadMarkings(road, zPosition, isCurved);
        return road;
    }

    addRoadMarkings(road, zPosition, isCurved) {
        const markingGeometry = new THREE.PlaneGeometry(0.3, 3);
        const markingMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
        
        for (let i = 0; i < this.roadLength / 6; i++) {
            const marking = new THREE.Mesh(markingGeometry, markingMaterial);
            marking.rotation.x = -Math.PI / 2;
            marking.position.set(0, 0.01, zPosition - this.roadLength/2 + i * 6);
            // if (isCurved) {
            //     marking.rotation.z = Math.PI / 12;
            // }
            this.scene.add(marking);
        }

        const sideMarkingGeometry = new THREE.PlaneGeometry(0.3, this.roadLength);
        const leftMarking = new THREE.Mesh(sideMarkingGeometry, markingMaterial);
        const rightMarking = new THREE.Mesh(sideMarkingGeometry, markingMaterial);
        
        leftMarking.rotation.x = -Math.PI / 2;
        rightMarking.rotation.x = -Math.PI / 2;
        
        // if (isCurved) {
        //     leftMarking.rotation.z = Math.PI / 12;
        //     rightMarking.rotation.z = Math.PI / 12;
        // }
        
        leftMarking.position.set(-this.roadWidth/2 + 0.3, 0.01, zPosition);
        rightMarking.position.set(this.roadWidth/2 - 0.3, 0.01, zPosition);
        
        this.scene.add(leftMarking);
        this.scene.add(rightMarking);
    }

    createEnvironment(zPosition) {
        // 나무 생성
        const treeCount = Math.floor(Math.random() * 8) + 5; // 나무 생성 개수 증가
        for (let i = 0; i < treeCount; i++) {
            const tree = this.createTree();
            const side = Math.random() > 0.5 ? 1 : -1;
            const distance = 20 + Math.random() * 20; // 도로에서 더 멀리 배치
            tree.position.set(side * distance, 0, zPosition + Math.random() * this.roadLength * 1.5); // 생성 범위 증가
            this.scene.add(tree);
            this.environmentElements.push(tree);
        }

        // 산 생성 (간헐적으로)
        if (Math.random() < 0.4) { // 산 생성 확률 증가
            const mountain = this.createMountain();
            const side = Math.random() > 0.5 ? 1 : -1;
            mountain.position.set(side * (50 + Math.random() * 30), 0, zPosition + Math.random() * this.roadLength * 1.5); // 산 위치 및 생성 범위 조정
            this.scene.add(mountain);
            this.environmentElements.push(mountain);
        }
    }

    createTree() {
        const tree = new THREE.Group();
        
        // 나무 줄기
        const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 1;
        tree.add(trunk);

        // 나뭇잎
        const leavesGeometry = new THREE.ConeGeometry(1, 2, 8);
        const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.y = 2.5;
        tree.add(leaves);

        return tree;
    }

    createMountain() {
        const mountain = new THREE.Group();
        
        // 산 본체
        const mountainGeometry = new THREE.ConeGeometry(Math.random() * 10 + 10, Math.random() * 15 + 15, Math.floor(Math.random() * 3) + 4); // 랜덤 크기 및 세그먼트
        const mountainMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x808080,
            flatShading: true
        });
        const mountainMesh = new THREE.Mesh(mountainGeometry, mountainMaterial);
        mountainMesh.rotation.y = Math.random() * Math.PI * 2; // 랜덤 회전
        mountain.add(mountainMesh);

        // 눈 덮인 정상
        const snowGeometry = new THREE.ConeGeometry(mountainGeometry.parameters.radius * 0.4, mountainGeometry.parameters.height * 0.3, mountainGeometry.parameters.radialSegments);
        const snowMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
        const snow = new THREE.Mesh(snowGeometry, snowMaterial);
        snow.position.y = mountainGeometry.parameters.height * 0.7; // 산 높이에 비례
        snow.rotation.y = Math.random() * Math.PI * 2; // 랜덤 회전
        mountain.add(snow);

        return mountain;
    }

    createClouds() {
        const cloudMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
        const cloudCount = 15; // 생성할 구름의 수 증가

        for (let i = 0; i < cloudCount; i++) {
            const cloudGeometry = new THREE.SphereGeometry(Math.random() * 5 + 2, 16, 16); // 랜덤 크기의 구체
            const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
            
            cloud.position.x = Math.random() * 400 - 200; // 넓은 범위에 배치
            cloud.position.y = 25 + Math.random() * 15; // 높은 위치에 배치
            cloud.position.z = this.car.position.z - 200 - Math.random() * 400; // 차량 뒤쪽 멀리 배치
            
            this.scene.add(cloud);
            this.environmentElements.push(cloud); // 환경 요소로 관리
        }
    }

    createCar(color = 0xff0000, type = 'sedan') { // 차량 색상 및 타입 인자로 받도록 수정
        const car = new THREE.Group();

        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.8,
            roughness: 0.2
        });

        let mainBody, cabin, hood, trunk, cargoBed;
        const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
        const wheelMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.5,
            roughness: 0.7
        });

        switch(type) {
            case 'sedan':
                // Base body
                mainBody = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 3), bodyMaterial);
                mainBody.position.y = 0.5;
                car.add(mainBody);

                // Cabin
                cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 1.5), bodyMaterial);
                cabin.position.set(0, 1.1, -0.2);
                car.add(cabin);

                // Hood
                hood = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 1), bodyMaterial);
                hood.position.set(0, 0.7, 1.5);
                car.add(hood);

                // Trunk
                trunk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.8), bodyMaterial);
                trunk.position.set(0, 0.7, -1.7);
                car.add(trunk);
                
                // Wheel positions for sedan
                const wheelPositionsSedan = [
                    { x: -0.9, y: 0.4, z: 1.2 },
                    { x: 0.9, y: 0.4, z: 1.2 },
                    { x: -0.9, y: 0.4, z: -1.2 },
                    { x: 0.9, y: 0.4, z: -1.2 }
                ];
                wheelPositionsSedan.forEach(pos => {
                    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
                    wheel.position.set(pos.x, pos.y, pos.z);
                    wheel.rotation.z = Math.PI / 2;
                    car.add(wheel);
                });

                // Headlights for sedan
                const headlightGeometrySedan = new THREE.SphereGeometry(0.2, 16, 16);
                const headlightMaterialSedan = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 0.5 });
                const leftHeadlightSedan = new THREE.Mesh(headlightGeometrySedan, headlightMaterialSedan);
                const rightHeadlightSedan = new THREE.Mesh(headlightGeometrySedan, headlightMaterialSedan);
                leftHeadlightSedan.position.set(-0.6, 0.5, 2);
                rightHeadlightSedan.position.set(0.6, 0.5, 2);
                car.add(leftHeadlightSedan);
                car.add(rightHeadlightSedan);

                break;

            case 'truck':
                // Chassis
                mainBody = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 4), bodyMaterial);
                mainBody.position.y = 0.4;
                car.add(mainBody);

                // Cabin
                cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 2), bodyMaterial);
                cabin.position.set(0, 1.5, 1);
                car.add(cabin);

                // Cargo Bed
                cargoBed = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 2), bodyMaterial);
                cargoBed.position.set(0, 0.9, -1.5);
                car.add(cargoBed);

                 // Wheel positions for truck
                const wheelPositionsTruck = [
                    { x: -1, y: 0.4, z: 1.8 },
                    { x: 1, y: 0.4, z: 1.8 },
                    { x: -1, y: 0.4, z: -1.8 },
                    { x: 1, y: 0.4, z: -1.8 }
                ];
                wheelPositionsTruck.forEach(pos => {
                    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
                    wheel.position.set(pos.x, pos.y, pos.z);
                    wheel.rotation.z = Math.PI / 2;
                    car.add(wheel);
                });

                 // Headlights for truck
                const headlightGeometryTruck = new THREE.SphereGeometry(0.2, 16, 16);
                const headlightMaterialTruck = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 0.5 });
                const leftHeadlightTruck = new THREE.Mesh(headlightGeometryTruck, headlightMaterialTruck);
                const rightHeadlightTruck = new THREE.Mesh(headlightGeometryTruck, headlightMaterialTruck);
                leftHeadlightTruck.position.set(-0.7, 0.8, 2.5);
                rightHeadlightTruck.position.set(0.7, 0.8, 2.5);
                car.add(leftHeadlightTruck);
                car.add(rightHeadlightTruck);

                break;

            case 'van':
                // Main Body
                mainBody = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 4), bodyMaterial);
                mainBody.position.y = 0.75;
                car.add(mainBody);

                // Front Hood/Engine area
                hood = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), bodyMaterial);
                hood.position.set(0, 0.5, 2);
                car.add(hood);

                 // Wheel positions for van
                const wheelPositionsVan = [
                    { x: -1.1, y: 0.4, z: 1.5 },
                    { x: 1.1, y: 0.4, z: 1.5 },
                    { x: -1.1, y: 0.4, z: -1.5 },
                    { x: 1.1, y: 0.4, z: -1.5 }
                ];
                 wheelPositionsVan.forEach(pos => {
                    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
                    wheel.position.set(pos.x, pos.y, pos.z);
                    wheel.rotation.z = Math.PI / 2;
                    car.add(wheel);
                });

                 // Headlights for van
                const headlightGeometryVan = new THREE.SphereGeometry(0.2, 16, 16);
                const headlightMaterialVan = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 0.5 });
                const leftHeadlightVan = new THREE.Mesh(headlightGeometryVan, headlightMaterialVan);
                const rightHeadlightVan = new THREE.Mesh(headlightGeometryVan, headlightMaterialVan);
                leftHeadlightVan.position.set(-0.8, 0.5, 2.1);
                rightHeadlightVan.position.set(0.8, 0.5, 2.1);
                car.add(leftHeadlightVan);
                car.add(rightHeadlightVan);

                break;

            case 'sport':
                // Low Profile Body
                mainBody = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.4, 3.5), bodyMaterial);
                mainBody.position.y = 0.3;
                car.add(mainBody);

                // Sloped Front
                 hood = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 1), bodyMaterial);
                hood.position.set(0, 0.5, 1.8);
                car.add(hood);

                 // Cabin (smaller)
                 cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.2), bodyMaterial);
                cabin.position.set(0, 0.7, -0.5);
                 car.add(cabin);

                 // Wheel positions for sport
                const wheelPositionsSport = [
                    { x: -0.9, y: 0.3, z: 1.5 },
                    { x: 0.9, y: 0.3, z: 1.5 },
                    { x: -0.9, y: 0.3, z: -1.5 },
                    { x: 0.9, y: 0.3, z: -1.5 }
                ];
                 wheelPositionsSport.forEach(pos => {
                    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
                    wheel.position.set(pos.x, pos.y, pos.z);
                    wheel.rotation.z = Math.PI / 2;
                    car.add(wheel);
                });

                 // Headlights for sport
                const headlightGeometrySport = new THREE.SphereGeometry(0.2, 16, 16);
                const headlightMaterialSport = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 0.5 });
                const leftHeadlightSport = new THREE.Mesh(headlightGeometrySport, headlightMaterialSport);
                const rightHeadlightSport = new THREE.Mesh(headlightGeometrySport, headlightMaterialSport);
                leftHeadlightSport.position.set(-0.6, 0.4, 2.1);
                rightHeadlightSport.position.set(0.6, 0.4, 2.1);
                car.add(leftHeadlightSport);
                car.add(rightHeadlightSport);

                break;

            default: // Default sedan design
                 // Base body
                mainBody = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 3), bodyMaterial);
                mainBody.position.y = 0.5;
                car.add(mainBody);

                // Cabin
                cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 1.5), bodyMaterial);
                cabin.position.set(0, 1.1, -0.2);
                car.add(cabin);

                // Hood
                hood = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 1), bodyMaterial);
                hood.position.set(0, 0.7, 1.5);
                car.add(hood);

                // Trunk
                trunk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.8), bodyMaterial);
                trunk.position.set(0, 0.7, -1.7);
                car.add(trunk);
                
                // Wheel positions for default sedan
                const wheelPositionsDefault = [
                    { x: -0.9, y: 0.4, z: 1.2 },
                    { x: 0.9, y: 0.4, z: 1.2 },
                    { x: -0.9, y: 0.4, z: -1.2 },
                    { x: 0.9, y: 0.4, z: -1.2 }
                ];
                wheelPositionsDefault.forEach(pos => {
                    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
                    wheel.position.set(pos.x, pos.y, pos.z);
                    wheel.rotation.z = Math.PI / 2;
                    car.add(wheel);
                });

                // Headlights for default sedan
                const headlightGeometryDefault = new THREE.SphereGeometry(0.2, 16, 16);
                const headlightMaterialDefault = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 0.5 });
                const leftHeadlightDefault = new THREE.Mesh(headlightGeometryDefault, headlightMaterialDefault);
                const rightHeadlightDefault = new THREE.Mesh(headlightGeometryDefault, headlightMaterialDefault);
                leftHeadlightDefault.position.set(-0.6, 0.5, 2);
                rightHeadlightDefault.position.set(0.6, 0.5, 2);
                car.add(leftHeadlightDefault);
                car.add(rightHeadlightDefault);

                break;
        }

        return car; // 생성된 차량 객체 반환
    }

    setupAudio() {
         // create a global audio source using OscillatorNode
        const audioContext = this.audioListener.context;
        this.engineOscillator = audioContext.createOscillator();
        this.gainNode = audioContext.createGain();

        this.engineOscillator.type = 'sawtooth'; // 기계음 느낌을 위해 sawtooth 파형 사용
        this.engineOscillator.frequency.setValueAtTime(40, audioContext.currentTime); // 초기 주파수를 40Hz로 더 낮춤

        this.engineOscillator.connect(this.gainNode);
        this.gainNode.connect(audioContext.destination);
        this.gainNode.gain.setValueAtTime(0, audioContext.currentTime); // 초기 볼륨 0

        this.engineOscillator.start();
    }

    createInitialRoad() {
        for (let i = 0; i < this.segmentCount; i++) {
            const zPos = i * this.roadLength;
            const isCurved = Math.random() < this.curveProbability;
            const segment = this.createRoadSegment(zPos, isCurved);
            this.roadSegments.push(segment);
            this.lastSegmentZ = zPos;
            this.createEnvironment(zPos);
        }
    }

    createOtherCar(zPosition) {
        console.log('Attempting to create other car at z:', zPosition);
        const colors = [0x0000ff, 0x00ff00, 0xffff00, 0xffa500, 0x800080, 0xffffff, 0x000000]; // 다양한 색상 추가
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        const carTypes = ['sedan', 'truck', 'van', 'sport']; // 다양한 차량 타입 추가
        const randomType = carTypes[Math.floor(Math.random() * carTypes.length)];

        const otherCar = this.createCar(randomColor, randomType); // 다른 색상과 타입으로 차량 생성
        
        const lane = Math.floor(Math.random() * 3) - 1; // -1, 0, 1 차선
        // 상대 자동차 생성 위치를 전달받은 zPosition(새 도로 세그먼트 위치) 기준으로 앞쪽으로 조정
        // Z축 양의 방향이 앞으로 가는 방향이라고 가정
        const spawnOffset = this.roadLength * 1.5 + Math.random() * this.roadLength; // 새 세그먼트 끝에서 roadLength*0.5~1.5 떨어진 곳
        otherCar.position.set(lane * (this.roadWidth / 4), 0.25, zPosition + spawnOffset);
        
        this.scene.add(otherCar);
        this.otherCars.push(otherCar);
        console.log('Other car created and added. Total other cars:', this.otherCars.length, 'Position:', otherCar.position);
    }

    updateRoad() {
        if (!this.isGameStarted) return;

        // Remove environment elements that are far behind the car
        // Iterate backwards to safely remove elements
        for (let i = this.environmentElements.length - 1; i >= 0; i--) {
            const element = this.environmentElements[i];
            // Check if element is a valid object before accessing properties
            if (element && element.position && element.position.z < this.car.position.z - this.roadLength * 2) {
                 // Keep ground as it's handled differently or static
                // Assuming ground is the only PlaneGeometry with width 2000
                if (!(element.geometry && element.geometry.type === 'PlaneGeometry' && element.geometry.parameters.width === 2000)) {
                    this.scene.remove(element);
                    this.environmentElements.splice(i, 1);
                }
            }
        }

        // Check if the car has passed the point where a new road segment should be created
        if (this.car.position.z > this.lastSegmentZ - this.roadLength) { // 새로운 도로 세그먼트 생성 조건을 조정
            const newZ = this.lastSegmentZ + this.roadLength;
            const isCurved = Math.random() < this.curveProbability;
            const newSegment = this.createRoadSegment(newZ, isCurved);
            this.roadSegments.push(newSegment);
            this.lastSegmentZ = newZ;
            this.createEnvironment(newZ);

            // 일정 확률로 다른 차량 생성 (확률 100% 유지)
            if (Math.random() < 1.0) { // 100% 확률로 다른 차량 생성
                // 새로운 도로 세그먼트 zPosition을 전달
                console.log('Condition met to create other car.');
                this.createOtherCar(newZ);
            }

            // Remove oldest road segment
            if (this.roadSegments.length > this.segmentCount) {
                const oldSegment = this.roadSegments.shift();
                this.scene.remove(oldSegment);
            }
        }

        // 다른 차량 위치 업데이트 및 제거
        for (let i = this.otherCars.length - 1; i >= 0; i--) { // Iterate backwards
            const otherCar = this.otherCars[i];
             // Check if otherCar is a valid object
            if (otherCar) {
                otherCar.position.z += this.speed * 0.8; // 플레이어 차량보다 약간 느리게 이동 (Z축 양의 방향으로)

                // 차량이 플레이어 차량보다 훨씬 뒤로 가면 제거 (제거 조건 수정)
                // Z축 양의 방향이 앞이라고 가정할 때, 플레이어 Z보다 작으면 뒤로 간 것임
                if (otherCar.position.z < this.car.position.z - this.roadLength) { // 플레이어 차량 Z 위치보다 도로 길이만큼 뒤로 가면 제거
                    console.log('Removing other car at position:', otherCar.position, 'Player position:', this.car.position);
                    this.scene.remove(otherCar);
                    this.otherCars.splice(i, 1);
                }
            } else {
                 // Remove invalid entry if found
                 console.log('Removing invalid entry from otherCars array at index', i);
                 this.otherCars.splice(i, 1);
            }
        }
    }

    checkCollisions() {
        if (!this.isGameStarted) return;

        const playerBoundingBox = new THREE.Box3().setFromObject(this.car);

        for (let i = 0; i < this.otherCars.length; i++) {
            const otherCar = this.otherCars[i];
            if (otherCar) {
                const otherCarBoundingBox = new THREE.Box3().setFromObject(otherCar);

                if (playerBoundingBox.intersectsBox(otherCarBoundingBox)) {
                    console.log("Collision!");
                    
                    // 충돌 시 물리적 밀림 효과 및 속도 감소만 적용
                    const collisionAngle = Math.atan2(
                        otherCar.position.x - this.car.position.x,
                        otherCar.position.z - this.car.position.z
                    );
                    
                    // 속도 감소
                    const speedReduction = 0.7; // 70% 감속
                    this.speed *= speedReduction;
                    
                    // 충돌 방향으로 밀림 효과
                    const pushbackDistance = 0.2; // 밀려나는 거리
                    this.car.position.x -= Math.sin(collisionAngle) * pushbackDistance;
                    this.car.position.z -= Math.cos(collisionAngle) * pushbackDistance;
                    
                    // 충돌한 상대 차량도 반대 방향으로 약간 밀림
                    otherCar.position.x += Math.sin(collisionAngle) * pushbackDistance;
                    otherCar.position.z += Math.cos(collisionAngle) * pushbackDistance;
                    
                    // 충돌 후 짧은 시간 동안 충돌 감지 비활성화 (무한 충돌 방지)
                    this.collisionDetected = true; // 임시 플래그 설정
                    setTimeout(() => {
                        this.collisionDetected = false;
                    }, 500); // 0.5초 후 충돌 감지 다시 활성화
                }
            }
        }
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.onWindowResize(), false);
        window.addEventListener('keydown', (e) => this.onKeyDown(e), false);
        window.addEventListener('keyup', (e) => this.onKeyUp(e), false);

        document.getElementById('start-button').addEventListener('click', () => {
            this.startGame();
        });
    }

    startGame() {
        this.isGameStarted = true;
        document.getElementById('start-screen').style.display = 'none';
        this.collisionDetected = false; // 게임 시작 시 충돌 플래그 초기화

         // Start engine sound
        if (this.engineOscillator) {
             const audioContext = this.audioListener.context;
             this.gainNode.gain.setValueAtTime(0.1, audioContext.currentTime); // 볼륨을 0.2에서 0.1로 더 낮춤
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    onKeyDown(event) {
        if (!this.isGameStarted || this.collisionDetected) return; // 충돌 감지 시 입력 무시

        switch(event.key) {
            case 'ArrowUp':
                this.speed = Math.min(this.speed + this.acceleration, this.maxSpeed);
                break;
            case 'ArrowDown':
                this.speed = Math.max(this.speed - this.acceleration, -this.maxSpeed / 2);
                break;
            case 'ArrowLeft':
                this.car.rotation.y += this.rotationSpeed;
                break;
            case 'ArrowRight':
                this.car.rotation.y -= this.rotationSpeed;
                break;
        }
    }

    onKeyUp(event) {
        if (!this.isGameStarted || this.collisionDetected) return; // 충돌 감지 시 입력 무시

        switch(event.key) {
            case 'ArrowUp':
            case 'ArrowDown':
                this.speed *= 0.95;
                break;
        }
    }

    updateCar() {
        if (!this.isGameStarted) return; // 충돌 감지 시에도 계속 업데이트

        this.car.position.x += Math.sin(this.car.rotation.y) * this.speed;
        this.car.position.z += Math.cos(this.car.rotation.y) * this.speed;

        // Adjust engine sound frequency based on speed
        if (this.engineOscillator && this.audioListener) {
             const audioContext = this.audioListener.context;
             // Map speed (0 to maxSpeed) to frequency (40Hz to 150Hz로 범위 조정)
            const minFrequency = 40;
            const maxFrequency = 150;
            const speedRatio = Math.abs(this.speed) / this.maxSpeed;
            const frequency = minFrequency + speedRatio * (maxFrequency - minFrequency);
            this.engineOscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        }

        this.camera.position.x = this.car.position.x - Math.sin(this.car.rotation.y) * 10;
        this.camera.position.z = this.car.position.z - Math.cos(this.car.rotation.y) * 10;
        this.camera.lookAt(this.car.position);

        const speedKmh = Math.abs(this.speed * 100);
        document.getElementById('speed').textContent = `Speed: ${speedKmh.toFixed(1)} km/h`;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.updateCar();
        this.updateRoad();
        this.checkCollisions(); // 충돌 감지 추가
        this.renderer.render(this.scene, this.camera);
    }
}

// Start the game
new RacingGame(); 