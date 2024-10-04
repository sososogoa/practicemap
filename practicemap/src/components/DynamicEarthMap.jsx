import React, { useState, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture, CameraControls, Stars } from "@react-three/drei";

import { View } from "ol";
import "ol/ol.css";
import proj4 from "proj4";
import { register } from "ol/proj/proj4.js";
import { Projection } from "ol/proj.js";
import { fromLonLat } from "ol/proj";
import { TileGrid } from "ol/tilegrid.js";
import TileLayer from "ol/layer/Tile";
import { TileWMS, XYZ } from "ol/source";
import { getWidth } from "ol/extent";
import Map from "ol/Map.js";
import Overlay from "ol/Overlay";

const Earth = ({ rotationSpeed = 0.002 }) => {
  const earthRef = useRef();
  const texture = useTexture("/textures/00_earthmap1k.jpg");

  useFrame(() => {
    if (earthRef.current) {
      earthRef.current.rotation.y += rotationSpeed;
    }
  });

  return (
    <mesh ref={earthRef}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial map={texture} />
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

  return (
    <CameraControls
      ref={cameraControlsRef}
      azimuthRotateSpeed={0}
      polarRotateSpeed={0}
    />
  );
};

proj4.defs(
  "EPSG:5181",
  "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs"
);
register(proj4);
const kakao = new Projection({
  code: "EPSG:5181",
  extent: [-30000, -60000, 494288, 988576],
});

const tileSize = 256;
const projExtent = kakao.getExtent();
const startResolution = getWidth(projExtent) / tileSize;
const resolutions = new Array(22);
for (let i = 0, ii = resolutions.length; i < ii; ++i) {
  resolutions[i] = startResolution / Math.pow(2, i);
}

const tileGrid = new TileGrid({
  extent: kakao.getExtent(),
  resolutions: resolutions,
  tileSize: [tileSize, tileSize],
});

const baseLayer = new TileLayer({
  source: new XYZ({
    projection: kakao,
    url: "http://map.daumcdn.net/map_k3f_prod/bakery/image_map_png/PNGSD01/v21_cclzf/{z}/{-y}/{x}.png",
    tileGrid: tileGrid,
    tileLoadFunction: function (imageTile, src) {
      let parts = src.split("v21_cclzf/");
      let pathParts = parts[1].split("/");
      let z = Number(pathParts[0]);
      let adjustedZ = 14 - z;
      console.log(z);
      const newSrc = src.replace(`/${z}/`, `/${adjustedZ}/`);
      imageTile.getImage().src = newSrc;
    },
  }),
  type: "Tile",
});

const skyViewLayer = new TileLayer({
  source: new XYZ({
    projection: kakao,
    url: "https://map.daumcdn.net/map_skyview/L{z}/{-y}/{x}.jpg?v=160114",
    tileGrid: tileGrid,
    tileLoadFunction: function (imageTile, src) {
      let parts = src.split("L");
      let pathParts = parts[1].split("/");
      let z = Number(pathParts[0]);
      let adjustedZ = 14 - z;
      console.log(z);
      const newSrc = `https://map.daumcdn.net/map_skyview/L${adjustedZ}/${pathParts[1]}/${pathParts[2]}.jpg?v=160114`;
      imageTile.getImage().src = newSrc;
    },
  }),
  type: "Tile",
});

const wmsLayer = new TileLayer({
  source: new TileWMS({
    url: "http://localhost:8888/geoserver/gis_test/wms",
    params: {
      VERSION: "1.1.0",
      tiled: true,
      LAYERS: [
        "gis_test:Z_KAIS_TL_SPRD_MANAGE_50_202409",
        "gis_test:Z_KAIS_TL_SPBD_EQB_50_202409",
        "gis_test:CH_D010_00_20241003",
      ],
    },
    serverType: "geoserver",
    tileGrid: tileGrid,
    transition: 0,
  }),
  opacity: 0.7,
});

const initializeMap = (
  mapRef,
  setZoom,
  setShowEarth,
  currentLayer,
  center,
  zoom
) => {
  const mapInstance = new Map({
    target: mapRef.current,
    layers: [currentLayer, wmsLayer],
    view: new View({
      projection: kakao,
      center: center,
      extent: kakao.getExtent(),
      zoom: zoom,
      minZoom: 3.5,
      maxZoom: 15,
    }),
  });

  const updateZoom = () => {
    const currentZoom = mapInstance.getView().getZoom();
    console.log(currentZoom);

    setZoom(currentZoom);
    if (Math.round(currentZoom * 100) / 100 <= 3.5) {
      setZoom(1.5);
      setShowEarth(true);
    }
  };

  mapInstance.getView().on("change:resolution", updateZoom);
  mapInstance.on("singleclick", function (evt) {
    const view = mapInstance.getView();
    const viewResolution = view.getResolution();
    const source = wmsLayer.getSource();
    const url = source.getFeatureInfoUrl(
      evt.coordinate,
      viewResolution,
      view.getProjection(),
      { INFO_FORMAT: "application/json" }
    );

    console.log(url);

    if (url) {
      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          if (data.features && data.features.length > 0) {
            const properties = data.features[0].properties;
            console.log("선택한 구역 정보:", properties);
          } else {
            console.log("해당 위치에 정보가 없습니다.");
          }
        })
        .catch((error) => {
          console.error("Error fetching feature info:", error);
        });
    }
  });

  return { mapInstance, updateZoom };
};

const DynamicEarthMap = () => {
  const [showEarth, setShowEarth] = useState(true);
  const [zoom, setZoom] = useState(5);
  const [currentLayer, setCurrentLayer] = useState(baseLayer);
  const mapRef = useRef();
  const mapInstanceRef = useRef();
  const cameraControlsRef = useRef();

  const toggleLayer = () => {
    let currentCenter;
    let currentZoom;
    if (mapInstanceRef.current) {
      currentCenter = mapInstanceRef.current.mapInstance.getView().getCenter();
      currentZoom = mapInstanceRef.current.mapInstance.getView().getZoom();

      console.log(currentZoom);
      mapInstanceRef.current.mapInstance.setTarget(undefined);
      mapInstanceRef.current.mapInstance
        .getView()
        .un("change:resolution", mapInstanceRef.current.updateZoom);
    } else {
      currentCenter = fromLonLat([128.940775, 35.97005278], kakao);
    }

    const nextLayer = currentLayer === baseLayer ? skyViewLayer : baseLayer;

    setCurrentLayer(nextLayer);

    mapInstanceRef.current = initializeMap(
      mapRef,
      setZoom,
      setShowEarth,
      nextLayer,
      currentCenter,
      currentZoom
    );
  };

  useEffect(() => {
    mapInstanceRef.current = initializeMap(
      mapRef,
      setZoom,
      setShowEarth,
      baseLayer,
      fromLonLat([128.940775, 35.97005278], kakao),
      3.6
    );

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.mapInstance.setTarget(undefined);
        mapInstanceRef.current.mapInstance
          .getView()
          .un("change:resolution", mapInstanceRef.current.updateZoom);
      }
    };
  }, []);

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

      <button
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          padding: "10px 15px",
          background: "white",
          border: "1px solid #ccc",
          borderRadius: "5px",
          cursor: "pointer",
        }}
        onClick={toggleLayer}
      >
        {currentLayer === baseLayer ? "스카이뷰 보기" : "일반 지도 보기"}
      </button>

      {/* {showEarth && (
        <Canvas camera={{ fov: 45, near: 0.1, far: 1000, position: [0, 0, zoom] }}>
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
          />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          <Earth />
        </Canvas>
      )} */}
    </div>
  );
};

export default DynamicEarthMap;
