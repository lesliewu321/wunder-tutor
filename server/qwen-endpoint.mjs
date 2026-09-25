// Shared by synthesis and key validation so credentials go to the selected service only.
const HOSTS = Object.freeze({
  singapore: 'dashscope-intl.aliyuncs.com',
  beijing: 'dashscope.aliyuncs.com',
  qwencloud: 'maas.qwencloudapi.com',
});

export function qwenHost(region = 'singapore') {
  return Object.hasOwn(HOSTS, region) ? HOSTS[region] : undefined;
}
