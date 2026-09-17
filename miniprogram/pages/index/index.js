const citiesData = require('../../data/cities');

const HOT_CITIES = ['北京','上海','广州','深圳','成都','重庆','杭州','西安','南京','武汉','长沙','厦门','青岛','大理','丽江','三亚','哈尔滨','桂林','拉萨','苏州'];

const PINYIN_MAP = {};
function buildPinyinMap() {
  const raw = {
    '北京':'beijing','上海':'shanghai','广州':'guangzhou','深圳':'shenzhen','成都':'chengdu',
    '重庆':'chongqing','杭州':'hangzhou','西安':'xian','南京':'nanjing','武汉':'wuhan',
    '长沙':'changsha','厦门':'xiamen','青岛':'qingdao','大理':'dali','丽江':'lijiang',
    '三亚':'sanya','哈尔滨':'haerbin','桂林':'guilin','拉萨':'lasa','苏州':'suzhou',
    '天津':'tianjin','昆明':'kunming','洛阳':'luoyang','张家界':'zhangjiajie','黄山':'huangshan',
    '贵阳':'guiyang','开封':'kaifeng'
  };
  Object.keys(raw).forEach(k => { PINYIN_MAP[k] = raw[k]; });
}
buildPinyinMap();

function haversine(lng1, lat1, lng2, lat2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function nearestNeighborRoute(pois) {
  if (pois.length <= 2) return pois.slice();
  const used = new Set();
  const route = [0];
  used.add(0);
  while (route.length < pois.length) {
    const last = route[route.length - 1];
    let bestIdx = -1, bestDist = Infinity;
    for (let i = 0; i < pois.length; i++) {
      if (used.has(i)) continue;
      const d = haversine(pois[last].lng, pois[last].lat, pois[i].lng, pois[i].lat);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    route.push(bestIdx);
    used.add(bestIdx);
  }
  return route.map(i => pois[i]);
}

Page({
  data: {
    latitude: 35.5,
    longitude: 104.5,
    zoom: 5,
    markers: [],
    polyline: [],
    hotCities: HOT_CITIES,
    searchText: '',
    filteredCities: [],
    currentCity: '',
    attractions: [],
    selectedCount: 0,
    panelExpanded: false,
    showSettingsDialog: false,
    amapWebKey: '',
    routeInfo: ''
  },

  onLoad() {
    const app = getApp();
    this.setData({ amapWebKey: app.globalData.amapWebKey || '' });
  },

  onSearchInput(e) {
    const text = e.detail.value.trim();
    this.setData({ searchText: text });
    if (!text) {
      this.setData({ filteredCities: [] });
      return;
    }
    const lower = text.toLowerCase();
    const allCities = Object.keys(citiesData);
    const filtered = allCities.filter(c =>
      c.includes(text) || (PINYIN_MAP[c] && PINYIN_MAP[c].includes(lower))
    );
    this.setData({ filteredCities: filtered.slice(0, 20) });
  },

  onSearchConfirm() {
    const { filteredCities } = this.data;
    if (filteredCities.length > 0) {
      this.selectCity({ currentTarget: { dataset: { city: filteredCities[0] } } });
    }
  },

  selectCity(e) {
    const city = e.currentTarget.dataset.city;
    const pois = citiesData[city];
    if (!pois || pois.length === 0) {
      wx.showToast({ title: '该城市暂无数据', icon: 'none' });
      return;
    }

    const attractions = pois.map(p => ({
      name: p.name,
      lng: p.lng,
      lat: p.lat,
      selected: false
    }));

    this.setData({
      currentCity: city,
      searchText: '',
      filteredCities: [],
      attractions: attractions,
      selectedCount: 0,
      markers: [],
      polyline: [],
      routeInfo: '',
      latitude: pois[0].lat,
      longitude: pois[0].lng,
      zoom: 12
    });
  },

  toggleAttraction(e) {
    const idx = e.currentTarget.dataset.index;
    const attractions = this.data.attractions;
    attractions[idx].selected = !attractions[idx].selected;
    const selectedCount = attractions.filter(a => a.selected).length;
    this.setData({ attractions, selectedCount });
    this.updateMarkers();
  },

  updateMarkers() {
    const selected = this.data.attractions.filter(a => a.selected);
    const markers = selected.map((a, i) => ({
      id: i,
      latitude: a.lat,
      longitude: a.lng,
      title: a.name,
      width: 30,
      height: 30,
      callout: {
        content: a.name,
        display: 'BYCLICK',
        bgColor: '#fff',
        color: '#333',
        fontSize: 12,
        borderRadius: 8,
        padding: 6
      },
      iconPath: ''
    }));
    this.setData({ markers });
  },

  optimizeRoute() {
    const selected = this.data.attractions.filter(a => a.selected);
    if (selected.length < 2) {
      wx.showToast({ title: '请至少选择2个景点', icon: 'none' });
      return;
    }

    const optimized = nearestNeighborRoute(selected);
    let totalDist = 0;
    const polylinePoints = [];
    for (let i = 0; i < optimized.length; i++) {
      polylinePoints.push({ latitude: optimized[i].lat, longitude: optimized[i].lng });
      if (i > 0) {
        totalDist += haversine(
          optimized[i-1].lng, optimized[i-1].lat,
          optimized[i].lng, optimized[i].lat
        );
      }
    }

    const markers = optimized.map((a, i) => ({
      id: i,
      latitude: a.lat,
      longitude: a.lng,
      title: `${i+1}. ${a.name}`,
      width: 30,
      height: 30,
      callout: {
        content: `${i+1}. ${a.name}`,
        display: 'ALWAYS',
        bgColor: '#fff',
        color: '#333',
        fontSize: 11,
        borderRadius: 8,
        padding: 6
      }
    }));

    const polyline = [{
      points: polylinePoints,
      color: '#2563eb',
      width: 3,
      dottedLine: false,
      arrowLine: true
    }];

    const distKm = (totalDist / 1000).toFixed(1);
    const routeInfo = `路线总距离约 ${distKm} 公里，途经 ${optimized.length} 个景点`;

    this.setData({ markers, polyline, routeInfo, panelExpanded: false });

    if (polylinePoints.length > 0) {
      this.mapCtx = wx.createMapContext('map');
      this.mapCtx.includePoints({
        points: polylinePoints,
        padding: [60, 60, 60, 60]
      });
    }
  },

  onMarkerTap(e) {
    // handled by callout
  },

  onRegionChange() {
    // placeholder
  },

  togglePanel() {
    this.setData({ panelExpanded: !this.data.panelExpanded });
  },

  showSettings() {
    this.setData({ showSettingsDialog: true });
  },

  hideSettings() {
    this.setData({ showSettingsDialog: false });
  },

  onKeyInput(e) {
    this.setData({ amapWebKey: e.detail.value });
  },

  saveSettings() {
    const key = this.data.amapWebKey.trim();
    wx.setStorageSync('amapWebKey', key);
    const app = getApp();
    app.globalData.amapWebKey = key;
    this.setData({ showSettingsDialog: false });
    wx.showToast({ title: '设置已保存', icon: 'success' });
  }
});
