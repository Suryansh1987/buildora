import { useState } from 'react';
import { TodoCard } from '@/components/TodoCard';
import { TodoForm } from '@/components/TodoForm';
import { TodoFilters } from '@/components/TodoFilters';
import { TodoStatsComponent } from '@/components/TodoStats';
import { useTodos } from '@/hooks/useTodos';
import { FilterOptions } from '@/types';
import { CheckSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TodoApp() {
  const {
    todos,
    editingTodo,
    isLoading,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
    filterTodos,
    setEditingTodo,
    getStats,
    getCategories
  } = useTodos();

  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    priority: 'all',
    category: 'all',
    searchTerm: ''
  });

  const handleFiltersChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
    filterTodos(newFilters);
  };

  const handleAddTodo = (todoData: Parameters<typeof addTodo>[0]) => {
    addTodo(todoData);
    setShowForm(false);
    setTimeout(() => filterTodos(filters), 0);
  };

  const handleUpdateTodo = (todoData: Parameters<typeof addTodo>[0]) => {
    if (editingTodo) {
      updateTodo(editingTodo.id, todoData);
      setTimeout(() => filterTodos(filters), 0);
    }
  };

  const handleEditTodo = (todo: Parameters<typeof setEditingTodo>[0]) => {
    setEditingTodo(todo);
    setShowForm(false);
  };

  const handleCancelEdit = () => {
    setEditingTodo(null);
  };

  const handleDeleteTodo = (id: string) => {
    deleteTodo(id);
    setTimeout(() => filterTodos(filters), 0);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <CheckSquare className="h-12 w-12 text-white mx-auto mb-4 animate-pulse" />
          <p className="text-lg text-white">Loading your todos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <CheckSquare className="h-10 w-10 text-white mr-3" />
<h1 className="text-4xl font-bold text-white">
              Master Blaster
            </h1>
          </div>
          <p className="text-white text-lg">Organize your tasks and boost your productivity</p>
        </div>

        {/* Stats */}
        <TodoStatsComponent stats={getStats()} />

        {/* Filters */}
        <TodoFilters 
          filters={filters}
          onFiltersChange={handleFiltersChange}
          categories={getCategories()}
        />

        {/* Add Todo Button - Mobile */}
        {!showForm && !editingTodo && (
          <div className="mb-6 md:hidden">
<Button 
              onClick={() => setShowForm(true)}
              className="w-full bg-white text-black hover:bg-gray-200"
              size="lg"
            >
              <img src="/path/to/your/image.png" alt="Add Todo" className="h-5 w-5 mr-2" />
              Add Todo
            </Button>
          </div>
        )}

        {/* Todo Form */}
        {(showForm || editingTodo) && (
          <TodoForm
            todo={editingTodo || undefined}
            onSubmit={editingTodo ? handleUpdateTodo : handleAddTodo}
            onCancel={editingTodo ? handleCancelEdit : () => setShowForm(false)}
            isEditing={!!editingTodo}
          />
        )}

        {/* Add Todo Button - Desktop */}
        {!showForm && !editingTodo && (
          <div className="hidden md:block mb-6">
<Button 
              onClick={() => setShowForm(true)}
              className="bg-white text-black hover:bg-gray-200"
              size="lg"
            >
              <img src="/path/to/your/image.png" alt="Add Todo" className="h-5 w-5 mr-2" />
              Add Todo
            </Button>
          </div>
        )}

        {/* Todos List */}
        <div className="space-y-4">
          {todos.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg">
              <CheckSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-black mb-2">
                {filters.searchTerm || filters.status !== 'all' || filters.priority !== 'all' || filters.category !== 'all'
                  ? 'No todos match your filters'
                  : 'No todos yet'
                }
              </h3>
              <p className="text-gray-600">
                {filters.searchTerm || filters.status !== 'all' || filters.priority !== 'all' || filters.category !== 'all'
                  ? 'Try adjusting your filters to see more todos'
                  : 'Create your first todo to get started'
                }
              </p>
            </div>
          ) : (
            todos.map((todo) => (
              <TodoCard
                key={todo.id}
                todo={todo}
                onToggle={toggleTodo}
                onEdit={handleEditTodo}
                onDelete={handleDeleteTodo}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}