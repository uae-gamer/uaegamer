window.Auth={
async refresh(){
  const {data:{user}}=await db.auth.getUser(); Store.state.user=user||null; Store.state.profile=null;
  if(user){const {data}=await db.from('profiles').select('*').eq('id',user.id).single(); Store.state.profile=data||null}
},
async login(email,password){const {error}=await db.auth.signInWithPassword({email,password});if(error)throw error;await this.refresh()},
async register(fd){
 const email=fd.get('email'),password=fd.get('password');
 const {error}=await db.auth.signUp({email,password,options:{data:{username:fd.get('username'),first_name:fd.get('first_name'),last_name:fd.get('last_name')}}});
 if(error)throw error;
},
async logout(){await db.auth.signOut();await this.refresh()},
async updateProfile(fd){
 const p={username:fd.get('username'),first_name:fd.get('first_name'),last_name:fd.get('last_name'),mobile_number:fd.get('mobile_number'),delivery_address:fd.get('delivery_address')};
 const {error}=await db.from('profiles').update(p).eq('id',Store.state.user.id);if(error)throw error;
 const pw=fd.get('new_password');if(pw){const r=await db.auth.updateUser({password:pw});if(r.error)throw r.error} await this.refresh();
}};