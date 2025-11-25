import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/adminApi';

export default function CategoryForm({ raceId, onCategoryAdded }) {
  const [name, setName] = useState('');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      const data = await adminApi.listCategories();
      setCategories(data);
    };
    fetchCategories();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const newCategory = await adminApi.createCategory({ name });
      onCategoryAdded(newCategory);
      setName('');
    } catch (error) {
      console.error('Failed to add category', error);
    }
  };

  const handleDelete = async (categoryId) => {
    if (window.confirm('Are you sure you want to delete this category?')) {
      try {
        await adminApi.deleteCategory(categoryId);
        setCategories(categories.filter(cat => cat.id !== categoryId));
      } catch (error) {
        console.error('Failed to delete category', error);
      }
    }
  };

  return (
    <div>
      <h3>Manage Categories</h3>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Category Name"
          required
        />
        <button type="submit">Add Category</button>
      </form>
      <ul>
        {categories.map((category) => (
          <li key={category.id}>
            {category.name}
            <button onClick={() => handleDelete(category.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}