import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture, CameraControls, Stars, OrbitControls } from '@react-three/drei';
import { Map as OLMap, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import { fromLonLat } from 'ol/proj';
import OSM from 'ol/source/OSM';
import 'ol/ol.css';
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4.js';
import { Projection } from 'ol/proj.js';
import Map from 'ol/Map.js';
import XYZ from 'ol/source/XYZ.js';
import { TileGrid } from 'ol/tilegrid.js';

proj4.defs('EPSG:5181', '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs');
register(proj4);

// const kakao = new Projection({
//   code: "EPSG:5181",
//   extent: [-30000, -60000, 494288, 988576], //지도 범위설정
// });

const kakao = new Projection({
  code: "EPSG:5181",
  extent: [-100000, -100000, 1000000, 1000000], // 더 넓은 범위 설정
});


const Earth = ({ rotationSpeed = 0.002 }) => {
  const earthRef = useRef();
  const texture = useTexture('/textures/00_earthmap1k.jpg');


  useFrame(() => {
    if (earthRef.current) {
      earthRef.current.rotation.y += rotationSpeed;
    }
  });

  return (
    <mesh ref={earthRef}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial
        map={texture}
      />
    </mesh>
  );
};

const CameraController = ({ setZoom, setShowEarth, cameraControlsRef }) => {
  const { camera } = useThree();

  const handleCameraUpdate = () => {
    const currentZoom = camera.position.z;

    setZoom(currentZoom);

    if (currentZoom < 1.5) {
      setShowEarth(false);
    } else if (currentZoom > 10) {
      setZoom(10);
    }
  };

  useFrame(() => {
    handleCameraUpdate();
  });

  return <CameraControls ref={cameraControlsRef} azimuthRotateSpeed={0} polarRotateSpeed={0} />;
};

const initializeMap = (mapRef, setZoom, setShowEarth) => {
  // const mapInstance = new OLMap({
  //   target: mapRef.current,
  //   layers: [new TileLayer({ source: new OSM() })],
  //   view: new View({
  //     center: fromLonLat([127.7669, 35.9078]),
  //     zoom: 3.6,
  //     minZoom: 3.5,
  //   }),
  // });

  
  const mapInstance = new Map({
    target: mapRef.current,
    layers: [
      new TileLayer({
        source: new XYZ({
          projection: kakao,
          url: 'http://map.daumcdn.net/map_k3f_prod/bakery/image_map_png/PNGSD01/v21_cclzf/{z}/{-y}/{x}.png',
          tileGrid: new TileGrid({
            // extent: [-10000, -60000, 494288, 988576],
            extent: [-100000, -100000, 1000000, 1000000], // 더 넓은 범위 설정
            resolutions: [2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1, 0.5, 0.25],
          }),
          tileLoadFunction: function (i, src) {
            let a = src.split('v21_cclzf/');
            let b = a[1].split('/');
            let z = Number(b[0]);
            let tZ = 14 - z;
            i.getImage().src = src.replace('/' + z + '/', '/' + tZ + '/');
          },
        }),
        type: 'Tile'
      })
    ],
    view: new View({
      projection: kakao, //좌표계 설정(default : 'EPSG:3857')
      center: fromLonLat([128.940775, 35.97005278], kakao), //지도 센터설정
      // extent: [261366.037460875, 216430.6425167995, 507126.037460875, 323310.6425167995],//지도 영역설정
      extent: [-100000, -100000, 1000000, 1000000], // 더 넓은 범위 설정
      constrainOnlyCenter: true, // 중심만 제한
      constrainResolution: false,  // 줌 레벨 이동 제한 여부      
      zoom: 3.6, //지도 줌
      minZoom: 3.5   //지도 최소 줌
    })
  });

  const updateZoom = () => {
    const currentZoom = mapInstance.getView().getZoom();
    setZoom(currentZoom);
    if (Math.round(currentZoom * 100) / 100 <= 3.5) {
      setZoom(1.5);
      setShowEarth(true);
    }
  };

  mapInstance.getView().on('change:resolution', updateZoom);

  return { mapInstance, updateZoom };
};

const DynamicEarthMap = () => {
  const [showEarth, setShowEarth] = useState(true);
  const [zoom, setZoom] = useState(5);
  const mapRef = useRef();
  const mapInstanceRef = useRef();
  const cameraControlsRef = useRef();

  useEffect(() => {
    mapInstanceRef.current = initializeMap(mapRef, setZoom, setShowEarth);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.mapInstance.setTarget(undefined);
        mapInstanceRef.current.mapInstance.getView().un('change:resolution', mapInstanceRef.current.updateZoom);
      }
    };
  }, [showEarth]);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {showEarth ? (
        <Canvas camera={{ fov: 45, near: 0.1, far: 1000, position: [0, 0, zoom] }}>
          <OrbitControls />
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[5, 10, 5]}
            intensity={1.5}
            castShadow
            shadow-mapSize-width={512}
            shadow-mapSize-height={512}
          />
          <spotLight position={[10, 15, 10]} angle={0.3} />
          <pointLight position={[-10, -10, -10]} />
          <Earth />
          <Stars
            radius={300}
            depth={60}
            count={20000}
            factor={7}
            saturation={0}
            fade={true}
          />
          <CameraController
            setZoom={setZoom}
            setShowEarth={setShowEarth}
            cameraControlsRef={cameraControlsRef}
            showEarth={showEarth}
          />
        </Canvas>
      ) : (
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      )}
    </div>
  );
};

export default DynamicEarthMap;
