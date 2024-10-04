/**
 * Author: 白羽
 * Date: 2024-10-04 13:08:35
 * LastEditors: 白羽
 * LastEditTime: 2024-10-04 13:08:35
 * Description: 广州市工贸技师学院 技实习自动签到打卡
 * Github: https://github.com/1665169869/jishixi_auto_checkin
 * Email: 1665169869@qq.com
 */

import axios from 'axios'
import CryptoJS from 'crypto-js';

const USERS = [
  {
    user_account: '学号',
    psw: '密码'
  }
]

const instance = axios.create({
  baseURL: 'https://gzgm.cydgsx.com',
  headers: {
    "User-Agent": "Mozilla/5.0 (Linux; Android 9; 23127PN0CC Build/PQ3A.190705.08211539; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Safari/537.36",
  }
});

instance.interceptors.response.use((resp) => {
  if (resp.request?.path.includes('/m/s/Log/SaveWriteLog')) {
    if (!resp.headers['content-type'].includes('application/json')) {
      return Promise.reject(resp);
    }
  }

  return resp;
}, (err) => {

  if (err.request?.path.includes('/m/home/appLogin') && err.response?.status === 302) {
    if (err.response?.headers['set-cookie'].length > 2) {

    }

    return Promise.resolve(err.response)
  }

  return Promise.reject(err);

})

function getSetCookieNameAndValue(setCookie) {
  setCookie = setCookie.split(';')[0];
  const index = setCookie.indexOf('=');
  return { [setCookie.slice(0, index)]: setCookie.slice(index + 1) }

}

const login = ({ user_account, psw }) => {
  return new Promise(async (resolve, reject) => {
    try {
      // 第一次请求，获取用户id和type
      const loginaResponse = await instance({
        url: '/logina',
        method: 'post',
        data: {
          params: JSON.stringify({
            "psw": psw,
            "user_account": user_account
          })
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        }
      })

      if (loginaResponse.status !== 200 || loginaResponse.data?.state !== 1) {
        throw new Error('登录失败');
      }

      const userId = loginaResponse.data?.result?.user_id;

      // 第二次请求，通过用户id和设备信息，发送验证
      const mobileModelAddResponse = await instance({
        url: '/mobileModelAdd',
        method: 'post',
        data: {
          params: JSON.stringify({
            "appType": "android",
            "appVersion": "5.0",
            "brand": "ipad",
            "manufacturer": "ipad",
            "model": "23127PN0CC",
            "release": "9",
            "user_id": userId
          })
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        }
      })

      // 第三次请求，通过用户id和type获取set-cookie请求头
      const appLoginResponse = await instance({
        url: `/m/home/appLogin`,
        method: 'get',
        params: {
          'jxnApp': '0',
          user_id: userId,
          type: 1
        },
        maxRedirects: 0,
      })



      if (appLoginResponse.status !== 302) {
        throw new Error('登录失败');
      }


      const setCookie = [...mobileModelAddResponse.headers['set-cookie'],
      ...appLoginResponse.headers['set-cookie']]

      let cookie = {};
      for (const item of setCookie) {
        const tempCookie = getSetCookieNameAndValue(item);
        // item = item.split(';')[0];
        // const index = item.indexOf('=');
        // cookie[item.slice(0, index)] = item.slice(index + 1);
        cookie = { ...cookie, ...tempCookie }
      }

      let tempCookie = '';
      for (const key in cookie) {
        tempCookie += `${key}=${cookie[key]}; `
      }

      const homeIndexResponse = await instance({
        url: '/m/s/Home/Index',
        method: 'get',
        headers: {
          'Cookie': tempCookie
        }
      })


      resolve(cookie);
    } catch (error) {
      reject(error);
    }
  })

}

const SaveWriteLog = async (cookie, key, keyValue) => {
  const data = {
    InternStateId: 1,
    interContent: "好好学习，天天向上。",
    logImg: null,
    posAddress: "中国广东省清远市清新区",
    posLong: 110.76330,
    posLati: 21.45080,
    locationType: 2,
    ArticleId: 0,
  }

  data[key] = encryptByDES(key, keyValue)


  const res = await instance({
    url: '/m/s/Log/SaveWriteLog',
    data: data,
    method: 'post',
    headers: {
      Cookie: cookie,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    }
  });

  if (res.status === 200) {
    console.log('打卡成功', JSON.stringify(res.data));
  }

}

const encryptByDES = (key, keyValue) => {
  var base64 = CryptoJS.enc.Utf8.parse(keyValue);
  var encrypt = CryptoJS.TripleDES.encrypt(key, base64, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7
  }
  );
  var encryptData = encrypt.toString();
  return encryptData;
}

const getEncryptKey = async (cookie) => {
  const res = await instance.get('m/s/Log/wLog?articleId=0', {
    headers: {
      Cookie: cookie
    }
  });
  return [...Object.entries(getSetCookieNameAndValue(res.headers['set-cookie'][0]))[0]];
}

(async () => {
  USERS.forEach(user => {
    console.log("正在登录用户", user.user_account);

    login({ "psw": "2003055153", "user_account": "2003055153" })
      .then(async cookieObject => {
        console.log('登录成功', cookieObject.loginUserName);

        let cookie = "";
        for (const key in cookieObject) {
          cookie += `${key}=${cookieObject[key]}; `
        }

        const [key, keyValue] = await getEncryptKey(cookie)

        SaveWriteLog(cookie, key, keyValue);
      })
      .catch(err => {
        console.log(user, '登录失败');
        console.log(err);
      })
  });
})()


