import Vue from "vue";
// Vue.use(require('vue-resource'));//引用ajax库
require("../css/steward.css");
import "whatwg-fetch";
const _ = require("underscore");
import { MessageBox, Toast, Indicator, Popup } from 'mint-ui';
import 'mint-ui/lib/style.css';
import Utils from "../Utils/utils";

const debug = (function() {
	let debug = false;
	let url = window.location.href;
	if (url.slice(0, 5) === "https") {
		debug = false;
	} else {
		debug = true;
	}
	return debug;
})();

window.getData = (data) => {
	window.localStorage.setItem("UserInfo", "Bearer " + data);
}

if (typeof window.jgkj !== "undefined") {
	window.localStorage.setItem("UserInfo", "Bearer " + window.jgkj.getUserInfo());
	// window.UserInfo = JSON.parse(window.jgkj.getUserInfo());
}
if (typeof window.webkit !== "undefined") {
	window.webkit.messageHandlers.getUserInfo.postMessage(['getData', ]);
}

/**
 * 从cookie中拿tooken,兼容有些浏览器没有设置cookie
 * @param  {[type]} ) {	let        cookie [description]
 * @return {[type]}   [description]
 */
const Authorization = (function() {
	if (window.localStorage.getItem("UserInfo")) {
		// app中
		let string = window.localStorage.getItem("UserInfo");
		// Toast({
		// 	message: JSON.parse(string).Access_Token,
		// 	position: 'center',
		// 	duration: 10000
		// })
		return JSON.parse(string).Access_Token;
	}
	let cookie = document.cookie;
	if (cookie === "") {
		return cookie;
	}

	let arrayCookie = cookie.split(";");

	for (let i = 0; i < arrayCookie.length; i++) {
		let item = arrayCookie[i].split("=");

		let key = item[0].trim();
		if (key === "access_token") {
			return "Bearer " + item[1];
		}
	}

	return ""; //如果没有就返回这个
})();

//检查请求返回的状态
function checkStatus(response) {
	if (response.status >= 200 && response.status < 300) {
		return response
	} else {
		if (response.status === 401) {
			window.location.href = "/api/oauth2/Index?returnUrl=https://ticket.samecity.com.cn/wx/ticket.html";
		} else {
			Indicator.close();
			alert("服务器繁忙,请稍后再试...")
		}
		return response;
	}
}

const config = {
	headers: {
		'Content-Type': 'application/json',
		Authorization: debug ? "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNDE1OTE5MDIwMDYwMzEiLCJqdGkiOiIxNTI5ODg0My0xZTFjLTQ3MTYtOTNkZC01ZTE4MTQ1MmNlMzEiLCJpYXQiOjE0ODc0MDM0OTUsIk1lbWJlciI6Im5vcm1hbCIsIm5iZiI6MTQ4NzQwMzQ5NCwiZXhwIjoxNDg4NjEzMDk0LCJpc3MiOiJTdXBlckF3ZXNvbWVUb2tlblNlcnZlciIsImF1ZCI6Imh0dHA6Ly9sb2NhbGhvc3Q6MTc4My8ifQ.41txARQUeaY18pPFH-kl-gxmmY2Q0XYN9v9FMAASu4c" : Authorization
	},
	serverUrl: debug ? "http://192.168.31.80" : ""
}

const Vue_User = new Vue({
	el: "#app",
	data: {
		ready: false, //页面为准备好
		// headerTitle:"已验票乘客(0/3)",
		haveId:false,//url上有这个id
		optionsPassenger:[],//可以选择乘车的乘客
		OrderDetail: {}, //订单详细信息
		Passengers: [], //乘客数据

		checkedNum:0,//已经验票乘客数
		
		inputCode:"",
		inputCodeNum:0,//用户输入的值
		codeArray:[],//存储的值
		left:"0",//输入框距离左边的距离

		AllOrder:[],//多个订单
		selectOrderIndex:0,//默认第一个
		myModal:false,//蒙版
	},
	created() {
		if (this.getQueryString("orderid")) {
			// 需要显示订单详细信息
			this.loading();
			this.getOrderInfo(this.getQueryString("orderid"));
		}
		
	},
	mounted() {
		this.ready = true;
	},
	computed:{
		
	},
	watch: {

	},
	methods: {
		loading() {
			Indicator.open({
				spinnerType: 'fading-circle'
			});
		},
		toast(title) {
			Toast({
				message: title,
				position: 'bottom',
				duration: 3000
			});
		},
		getQueryString(name) {
			let reg = new RegExp('(^|&)' + name + '=([^&]*)(&|$)', 'i');
			let r = window.location.search.substr(1).match(reg);
			if (r !== null) {
				return unescape(r[2]);
			}
			return null;
		},
		getOrderInfo(id) {
			return fetch(config.serverUrl + "/api/Steward/GetOrder", {
					method: "POST",
					headers: config.headers,
					body: JSON.stringify({
						OrderId: id
					})
				}).then(result => result.json())
				.then(result => {
					if(result.Code!==200){
						// 没有权限查看
						Indicator.close();
						MessageBox.alert(result.Message)
						// this.toast(result.Message);
						return;
					}
					this.OrderDetail = result.Data;
					// this.passenger = [];
					this.optionsPassenger = [];
					for (let i = 0; i < this.OrderDetail.Passengers.length; i++) {
						let item = this.OrderDetail.Passengers[i];
						if (item.Status === -3) {
							item.Name = item.Name + "(已退款)";
							// this.passenger.push(item);
							item.vaild = true;//不能上车
							// continue; //这个乘客已经退款就不显示
						}
						if (item.Status === -1) {
							item.Name = item.Name + "(审核中)";
							// this.passenger.push(item);
							item.vaild = true;//不能上车
						}
						if (item.Status === -2) {
							item.Name = item.Name + "(待退款)";
							// this.passenger.push(item);
							item.vaild = true;//不能上车
						}
						if (item.Status === 1) {
							// this.passenger.push(item);
							item.vaild = false;//能上车
						}
						if(item.Status ===2){
							item.vaild = true;
							this.checkedNum++;
							item.checked = true;//已经验证过
						}

						this.optionsPassenger.push({ Name: item.Name,Mobile:item.Mobile, Price: item.Price, DId: item.DId, active: false,vaild:item.vaild,checked:item.checked?true:false }); //提供申请退款选择的用户名
					}
					this.haveId = true;
					Indicator.close();
				})
		},
		selectUp(index){
			if(this.optionsPassenger[index].vaild){
				// 不是可选的
				return;
			}
			this.Passengers = [];
			this.optionsPassenger[index].active = !this.optionsPassenger[index].active;
			
			this.optionsPassenger.map((item,index)=>{
				if(item.active){
					this.Passengers.push(item.DId);
				}
			})
		},
		selectAll(){
			this.Passengers = [];
			this.optionsPassenger.map((item,index)=>{
				if(!item.checked){
					item.active = true;
					this.Passengers.push(item.DId);
				}
			})
		},
		yes(){
			if(this.Passengers.length!==0){
				this.fetchYes();
			}
			else{
				this.toast("请选择需要乘车的乘客!");
			}
		},
		fetchYes(){
			this.loading();
			fetch(config.serverUrl + "/api/Steward/ConfirmRide", {
					method: "POST",
					headers: config.headers,
					body: JSON.stringify({
						DIds: this.Passengers
					})
				}).then(result => result.json())
				.then(result => {
					if(result.Data){
						// 验证成功
						this.Passengers.map((item,index)=>{
							for(let i=0;i<this.optionsPassenger.length;i++){
								if(item.DId===this.optionsPassenger[i].Did){
									// 已经验证的乘客
									this.optionsPassenger[i].checked = true;
									this.optionsPassenger[i].vaild = true;
									this.optionsPassenger[i].active = false;
								}
							}
						})
					}
					else{
						this.toast(result.Message);
					}
					Indicator.close();
				})
		},
		backInput(){
			if(this.inputCodeNum===5){
				this.inputCodeNum--;
				let n = 16.6666*(this.inputCodeNum);
				this.left = n+"%";
				this.codeArray.pop();
				return;
			}
			if(this.inputCodeNum!==0){
				this.inputCodeNum--;
				this.codeArray.pop();
				let n = 16.6666*(this.inputCodeNum);
				this.left = n+"%";
			}
		},
		inputCodeEvent(event){
			if(event.keyCode>=48&&event.keyCode<=57){
				let code = event.target.value;//code
				
				if(this.inputCodeNum<5){
					this.codeArray.push(code);
					this.inputCode = "";
					this.inputCodeNum++;
					let n = 16.6666*this.inputCodeNum
					this.left = n+"%";
				}
				else{
					if(this.inputCodeNum===5){
						this.inputCodeNum++;
						this.codeArray.push(code);
					}
				}
			}
		},
		verifyCode(){
			if(this.codeArray.length!==6){
				this.toast("请输入完整验证码");
				return;
			}

			this.loading();//加载动画

			let code = "";
			this.codeArray.map(item=>{
				code+=item;
			})
			// /api/Steward/GetOrderByCode
			fetch(config.serverUrl + "/api/Steward/GetOrderByCode?code="+code, {
					method: "GET",
					headers: config.headers,
				}).then(result => result.json())
				.then(result => {
					Indicator.close();
					if(result.Code!==200){
						// 没有权限查看
						MessageBox.alert(result.Message)
						// this.toast(result.Message);
						return;
					}
					// 如果订单不止一个
					if(result.Data.length!==1){
						this.AllOrder = result.Data;
						this.selectOrder();
						return;
					}
					this.OrderDetail = result.Data[0];
					// this.passenger = [];
					this.initData();
				})
		},
		initData(){
			this.optionsPassenger = [];
			for (let i = 0; i < this.OrderDetail.Passengers.length; i++) {
				let item = this.OrderDetail.Passengers[i];
				if (item.Status === -3) {
					item.Name = item.Name + "(已退款)";
					// this.passenger.push(item);
					item.vaild = true;//不能上车
					// continue; //这个乘客已经退款就不显示
				}
				if (item.Status === -1) {
					item.Name = item.Name + "(审核中)";
					// this.passenger.push(item);
					item.vaild = true;//不能上车
				}
				if (item.Status === -2) {
					item.Name = item.Name + "(待退款)";
					// this.passenger.push(item);
					item.vaild = true;//不能上车
				}
				if (item.Status === 1) {
					// this.passenger.push(item);
					item.vaild = false;//能上车
				}
				if(item.Status ===2){
					item.vaild = true;
					this.checkedNum++;
					item.checked = true;//已经验证过
				}

				this.optionsPassenger.push({ Name: item.Name,Mobile:item.Mobile, Price: item.Price, DId: item.DId, active: false,vaild:item.vaild,checked:item.checked?true:false }); //提供申请退款选择的用户名
			}
			this.haveId = true;
		},
		/** 选择订单(如果有多个订单) */
		selectOrder(){
			// console.log(this.AllOrder)
			this.myModal = true;
		},
		/** 点击选择的订单 */
		selectOrderAction(index){
			this.selectOrderIndex = index;
		},
		/** 确定选择这个订单 */
		getOrder(){
			this.OrderDetail = this.AllOrder[this.selectOrderIndex];
			this.myModal = false;
			this.initData();
		}
	},
	directives:{
		edit:{
			update(newval,oldval){
				console.log(newval)
				if(newval){
					console.log(newval)
				}
			}
		}
	},
	components: {
		"mt-popup": Popup,
	}
});

// document.body.addEventListener('touchmove', function(event) { 
// event.preventDefault(); 
// }, false);