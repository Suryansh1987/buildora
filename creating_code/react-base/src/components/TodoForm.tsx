import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Todo } from '@/types';
import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';

interface TodoFormProps {
  todo?: Todo;
  onSubmit: (todo: Omit<Todo, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

export function TodoForm({ todo, onSubmit, onCancel, isEditing = false }: TodoFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [category, setCategory] = useState('Personal');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (todo) {
      setTitle(todo.title);
      setDescription(todo.description || '');
      setPriority(todo.priority);
      setCategory(todo.category);
      setDueDate(todo.dueDate || '');
    }
  }, [todo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      category,
      completed: todo?.completed || false,
      dueDate: dueDate || undefined
    });

    if (!isEditing) {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setCategory('Personal');
      setDueDate('');
    }
  };

  return (
    <Card className="mb-6 bg-white border-gray-300">
      <CardHeader>
        <div className="flex items-center justify-between">
<CardTitle className="text-xl text-black">
            {isEditing ? 'Edit Master Blaster' : 'Add New Master Blaster'}
          </CardTitle>
          {isEditing && (
            <Button variant="ghost" size="sm" onClick={onCancel} className="text-black hover:bg-gray-200">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title" className="text-black">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter todo title"
                required
                className="border-gray-300 text-black placeholder-gray-400"
              />
            </div>
            <div>
              <Label htmlFor="category" className="text-black">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="border-gray-300 text-black">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  <SelectItem value="Personal">Personal</SelectItem>
                  <SelectItem value="Work">Work</SelectItem>
                  <SelectItem value="Health">Health</SelectItem>
                  <SelectItem value="Shopping">Shopping</SelectItem>
                  <SelectItem value="Education">Education</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div>
            <Label htmlFor="description" className="text-black">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter todo description (optional)"
              rows={3}
              className="border-gray-300 text-black placeholder-gray-400"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority" className="text-black">Priority</Label>
              <Select value={priority} onValueChange={(value: 'low' | 'medium' | 'high') => setPriority(value)}>
                <SelectTrigger className="border-gray-300 text-black">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="dueDate" className="text-black">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="border-gray-300 text-black"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            {isEditing && (
              <Button type="button" variant="outline" onClick={onCancel} className="border-gray-300 text-black hover:bg-gray-200">
                Cancel
              </Button>
            )}
<Button type="submit" className="bg-black text-white hover:bg-gray-800">
  <img src="/path/to/your/image.png" alt="Add Todo" className="h-4 w-4 mr-2" />
  {isEditing ? 'Update Todo' : 'Add Todo'}
</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}