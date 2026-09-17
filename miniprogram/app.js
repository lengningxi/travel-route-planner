App({
  globalData: {
    amapKey: '',
    amapWebKey: ''
  },
  onLaunch() {
    const key = wx.getStorageSync('amapWebKey');
    if (key) {
      this.globalData.amapWebKey = key;
    }
  }
});
