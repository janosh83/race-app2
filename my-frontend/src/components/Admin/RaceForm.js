import React, {useState} from 'react';
import { adminApi } from '../../services/adminApi';

export default function RaceForm({onCreated}){
  const [name,setName] = useState('');
  const handleSubmit = async (e)=>{
    e.preventDefault();
    const payload = { name };
    const created = await adminApi.createRace(payload);
    onCreated && onCreated(created);
    setName('');
  };
  return (
    <form onSubmit={handleSubmit} className="mb-3">
      <h4>Create race</h4>
      <div className="input-group">
        <input className="form-control" value={name} onChange={e=>setName(e.target.value)} placeholder="Race name" required />
        <button className="btn btn-primary" type="submit">Create</button>
      </div>
    </form>
  );
}